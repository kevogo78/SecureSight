"""Contract checks for the drop-in EC2 backend; no AWS resources are modified."""
import importlib.util
from datetime import datetime, timedelta, timezone
from pathlib import Path
import unittest
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

spec = importlib.util.spec_from_file_location("aws_backend", Path(__file__).parents[1] / "aws_main.py")
backend = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backend)


class AWSCompatibilityTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(backend.app)
        self.conn = MagicMock()
        self.cur = MagicMock()
        self.conn.cursor.return_value.__enter__.return_value = self.cur
        self.endpoint = {
            "endpoint_id": 42, "hostname": "MY-PC", "metadata": {}, "kicked": False,
            "last_seen": datetime.now(timezone.utc),
        }
        self.cur.fetchone.return_value = self.endpoint
        self.db_patch = patch.object(backend, "get_db", return_value=self.conn)
        self.db_patch.start()
        self.addCleanup(self.db_patch.stop)
        self.payload = {
            "hostname": "MY-PC", "endpoint_id": 1, "active_app": "notepad.exe",
            "cpu_percent": 0, "ram_percent": 47, "keystroke_count": 3,
        }

    def test_agent_payload_saved_with_registry_id(self):
        response = self.client.post("/api/v1/telemetry", json=self.payload)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["database_saved"])
        self.assertEqual(response.json()["endpoint_id"], 42)
        inserts = [c for c in self.cur.execute.call_args_list if "INSERT INTO telemetry_logs" in c.args[0]]
        self.assertEqual(len(inserts), 1)
        self.assertEqual(inserts[0].args[1][3].adapted["cpu_percent"], 0)
        self.conn.__exit__.assert_called_once()
        self.conn.close.assert_called_once()

    def test_legacy_payload_remains_supported(self):
        response = self.client.post("/api/v1/telemetry", json={
            "hostname": "MY-PC", "timestamp": "2026-10-06T12:00:00Z",
            "metrics": {"cpu_percent": 7}, "event_type": "heartbeat",
        })
        self.assertEqual(response.status_code, 200)

    def test_invalid_metrics_rejected_before_database_use(self):
        response = self.client.post("/api/v1/telemetry", json={**self.payload, "cpu_percent": 101})
        self.assertEqual(response.status_code, 422)
        self.cur.execute.assert_not_called()

    def test_database_failure_is_not_success(self):
        self.cur.execute.side_effect = RuntimeError("database unavailable")
        response = self.client.post("/api/v1/telemetry", json=self.payload)
        self.assertEqual(response.status_code, 503)
        self.assertNotIn("database unavailable", response.text)
        self.conn.close.assert_called_once()

    def test_commit_failure_is_not_success(self):
        self.conn.__exit__.side_effect = RuntimeError("commit failed")
        self.assertEqual(self.client.post("/api/v1/telemetry", json=self.payload).status_code, 503)
        self.conn.close.assert_called_once()

    def test_offline_endpoint_and_zero_metrics(self):
        self.endpoint["last_seen"] -= timedelta(seconds=70)
        self.endpoint["metadata"] = {"cpu_percent": 0, "ram_percent": 0}
        self.cur.fetchall.return_value = [self.endpoint]
        response = self.client.get("/api/v1/endpoints")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()[0]["status"], "Offline")
        self.assertEqual(response.json()[0]["cpu"], 0)

    def test_empty_database_returns_no_sample_devices(self):
        self.cur.fetchall.return_value = []
        self.assertEqual(self.client.get("/api/v1/endpoints").json(), [])
        self.assertEqual(self.client.get("/api/v1/audit/logs").json(), [])

    def test_audit_contract_uses_same_endpoint_id(self):
        self.cur.fetchall.return_value = [{
            "hostname": "MY-PC", "endpoint_id": 42, "timestamp": datetime.now(timezone.utc),
            "event_type": "heartbeat", "metrics": {"log_id": "abc", "keystroke_count": 4},
        }]
        log = self.client.get("/api/v1/audit/logs").json()[0]
        self.assertEqual(log["endpoint_id"], 42)
        self.assertEqual(log["keystrokes"], 4)
        self.assertIsNone(log["media_url"])

    def test_s3_request_has_matching_content_type(self):
        fake_s3 = MagicMock()
        fake_s3.generate_presigned_url.return_value = "https://example.invalid/upload"
        with patch.dict("os.environ", {"S3_BUCKET": "test-bucket"}), patch.object(backend, "s3", return_value=fake_s3):
            response = self.client.post("/api/v1/telemetry", json={
                **self.payload, "capture_requested": True, "file_hash": "abc", "encryption_iv": "123",
            })
        self.assertEqual(response.json()["upload_url"], "https://example.invalid/upload")
        params = fake_s3.generate_presigned_url.call_args.kwargs["Params"]
        self.assertEqual(params["ContentType"], "application/octet-stream")
        self.assertTrue(params["Key"].startswith("screenshots/42/"))

    def test_kicked_device_does_not_insert_telemetry(self):
        self.endpoint["kicked"] = True
        response = self.client.post("/api/v1/telemetry", json=self.payload)
        self.assertEqual(response.json()["status"], "kicked")
        self.assertFalse(any("INSERT INTO telemetry_logs" in c.args[0] for c in self.cur.execute.call_args_list))

    def test_s3_confirmation_requires_existing_object(self):
        self.cur.fetchone.return_value = {"metrics": {"s3_bucket": "bucket", "s3_key": "file.enc"}}
        fake_s3 = MagicMock()
        fake_s3.head_object.return_value = {"ContentLength": 123}
        with patch.object(backend, "s3", return_value=fake_s3):
            response = self.client.post("/api/v1/media/12345678-1234-1234-1234-123456789abc/complete")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "uploaded")
        update = self.cur.execute.call_args.args[1][0].adapted
        self.assertEqual(update["upload_bytes"], 123)

    def test_missing_s3_object_not_marked_uploaded(self):
        self.cur.fetchone.return_value = {"metrics": {"s3_bucket": "bucket", "s3_key": "file.enc"}}
        fake_s3 = MagicMock()
        fake_s3.head_object.side_effect = RuntimeError("object missing")
        with patch.object(backend, "s3", return_value=fake_s3):
            response = self.client.post("/api/v1/media/12345678-1234-1234-1234-123456789abc/complete")
        self.assertEqual(response.status_code, 502)
        self.assertFalse(any("UPDATE telemetry_logs" in c.args[0] for c in self.cur.execute.call_args_list))


if __name__ == "__main__":
    unittest.main()
