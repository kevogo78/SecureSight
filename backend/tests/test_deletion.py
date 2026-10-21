"""Tests for Keylog and Screenshot Deletion Endpoints (Single & Batch)."""
import os
import io
from unittest.mock import MagicMock, patch
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

# Mock DB pool and boto3 during module import to avoid live AWS connection
with patch("psycopg2.pool.ThreadedConnectionPool", create=True), \
     patch("psycopg2.pool.SimpleConnectionPool", create=True), \
     patch("boto3.client"):
    from src.routes import endpoints, media


@pytest.fixture
def test_app():
    app = FastAPI()
    app.include_router(endpoints.router)
    app.include_router(media.router)
    return TestClient(app)


def test_delete_single_keylog(test_app, tmp_path, monkeypatch):
    """Test DELETE /api/v1/endpoints/{id}/keylogs/{filename}."""
    monkeypatch.chdir(tmp_path)
    keylog_dir = tmp_path / "backend" / "keylogs" / "5"
    keylog_dir.mkdir(parents=True, exist_ok=True)
    test_file = keylog_dir / "WORKSTATION-WIN11_20261021_120000_pause.txt"
    test_file.write_text("sample log", encoding="utf-8")

    mock_s3 = MagicMock()
    with patch.object(endpoints, "s3_client", mock_s3), patch.object(endpoints, "S3_BUCKET", "test-bucket"):
        resp = test_app.delete(f"/api/v1/endpoints/5/keylogs/{test_file.name}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "success"
        assert not os.path.exists(test_file)
        mock_s3.delete_object.assert_called()


def test_batch_delete_keylogs(test_app, tmp_path, monkeypatch):
    """Test POST /api/v1/endpoints/{id}/keylogs/batch-delete."""
    monkeypatch.chdir(tmp_path)
    keylog_dir = tmp_path / "backend" / "keylogs" / "7"
    keylog_dir.mkdir(parents=True, exist_ok=True)
    f1 = keylog_dir / "HOST_20261021_120000_1-min.txt"
    f2 = keylog_dir / "HOST_20261021_120100_pause.txt"
    f1.write_text("log 1", encoding="utf-8")
    f2.write_text("log 2", encoding="utf-8")

    mock_s3 = MagicMock()
    with patch.object(endpoints, "s3_client", mock_s3), patch.object(endpoints, "S3_BUCKET", "test-bucket"):
        payload = {"filenames": [f1.name, f2.name]}
        resp = test_app.post("/api/v1/endpoints/7/keylogs/batch-delete", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["deleted_count"] == 2
        assert not os.path.exists(f1)
        assert not os.path.exists(f2)


def test_list_keylogs_with_new_naming(test_app, tmp_path, monkeypatch):
    """Test that list_endpoint_keylogs recognizes endpoint-named files in the endpoint directory."""
    monkeypatch.chdir(tmp_path)
    keylog_dir = tmp_path / "backend" / "keylogs" / "9"
    keylog_dir.mkdir(parents=True, exist_ok=True)
    f = keylog_dir / "LAPTOP-DEV_20261021_150000_1-min.txt"
    f.write_text("keystrokes here", encoding="utf-8")

    resp = test_app.get("/api/v1/endpoints/9/keylogs")
    assert resp.status_code == 200
    files = resp.json()
    assert len(files) == 1
    assert files[0]["filename"] == f.name
    assert files[0]["event_type"] == "1-Min Active"


def test_delete_single_screenshot(test_app):
    """Test DELETE /api/v1/media/{capture_id}."""
    conn = MagicMock()
    cur = conn.cursor.return_value.__enter__.return_value
    cur.fetchone.return_value = ("telemetry-bucket", "screenshots/1/100.enc", 100)
    mock_s3 = MagicMock()

    with patch.object(media, "get_db_connection") as db, patch.object(media, "s3_client", mock_s3):
        db.return_value.__enter__.return_value = conn
        resp = test_app.delete("/api/v1/media/10")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "success"
        assert data["capture_id"] == 10
        cur.execute.assert_any_call("DELETE FROM media_captures WHERE capture_id = %s", (10,))
        mock_s3.delete_object.assert_called_once_with(Bucket="telemetry-bucket", Key="screenshots/1/100.enc")


def test_batch_delete_screenshots(test_app):
    """Test POST /api/v1/media/batch-delete."""
    conn = MagicMock()
    cur = conn.cursor.return_value.__enter__.return_value
    cur.fetchall.return_value = [
        (101, "bucket-a", "key1.enc", 10),
        (102, "bucket-a", "key2.enc", 11)
    ]
    mock_s3 = MagicMock()

    with patch.object(media, "get_db_connection") as db, patch.object(media, "s3_client", mock_s3):
        db.return_value.__enter__.return_value = conn
        resp = test_app.post("/api/v1/media/batch-delete", json={"capture_ids": [101, 102], "log_ids": []})
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "success"
        assert data["deleted_count"] == 2
        assert mock_s3.delete_object.call_count == 2

