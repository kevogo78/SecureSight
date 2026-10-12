"""Media authorization/decryption checks with database and S3 mocked."""
import hashlib
import io
from unittest.mock import MagicMock, patch

import pytest
from botocore.exceptions import ClientError
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from fastapi import FastAPI
from fastapi.testclient import TestClient

# Avoid contacting RDS or AWS during module import.
with patch("psycopg2.pool.SimpleConnectionPool"), patch("boto3.client"):
    from src.routes import auth, media


@pytest.fixture
def setup(monkeypatch):
    monkeypatch.setenv("DASHBOARD_SESSION_SECRET", "s" * 64)
    monkeypatch.setenv("DASHBOARD_ADMIN_PASSWORD", "test-password")
    monkeypatch.setenv("DASHBOARD_COOKIE_SECURE", "false")
    monkeypatch.setenv("SCREENSHOT_KEY_HEX", "01" * 32)
    app = FastAPI()
    app.include_router(auth.router)
    app.include_router(media.router)
    client = TestClient(app)
    # The route verifies JPEG envelope and authenticated plaintext, not encoding.
    raw = b"\xff\xd8\xfftest-image\xff\xd9"
    nonce = b"n" * 12
    encrypted = AESGCM(bytes.fromhex("01" * 32)).encrypt(nonce, raw, None)
    conn = MagicMock()
    cur = conn.cursor.return_value.__enter__.return_value
    cur.fetchone.return_value = ("bucket", "screenshots/42/277.enc", nonce.hex(), hashlib.sha256(raw).hexdigest())
    store = MagicMock()
    store.get_object.return_value = {"Body": io.BytesIO(encrypted), "ContentLength": len(encrypted)}
    with patch.object(media, "get_db_connection") as db, patch.object(media, "s3_client", store):
        db.return_value.__enter__.return_value = conn
        yield client, db, cur, store, raw


def login(client):
    result = client.post("/api/v1/auth/login", json={"username": "administrator", "password": "test-password"})
    assert result.status_code == 200
    assert "HttpOnly" in result.headers["set-cookie"]


def test_unsigned_viewer_cannot_read_s3(setup):
    client, db, _, store, _ = setup
    assert client.get("/api/v1/media/1/image").status_code == 401
    db.assert_not_called()
    store.get_object.assert_not_called()


def test_admin_gets_jpeg_without_caching_or_key_exposure(setup):
    client, _, _, store, raw = setup
    login(client)
    result = client.get("/api/v1/media/1/image")
    assert result.status_code == 200
    assert result.content == raw
    assert result.headers["content-type"] == "image/jpeg"
    assert "no-store" in result.headers["cache-control"]
    store.get_object.assert_called_once_with(Bucket="bucket", Key="screenshots/42/277.enc")


def test_wrong_password_and_tampered_cookie_are_rejected(setup):
    client, _, _, store, _ = setup
    assert client.post("/api/v1/auth/login", json={"username": "administrator", "password": "wrong"}).status_code == 401
    client.cookies.set(auth.COOKIE, "9999999999.nonce.invalid")
    assert client.get("/api/v1/media/1/image").status_code == 401
    store.get_object.assert_not_called()


def test_wrong_decryption_key_does_not_return_plaintext(setup, monkeypatch):
    client, _, _, _, raw = setup
    login(client)
    monkeypatch.setenv("SCREENSHOT_KEY_HEX", "02" * 32)
    result = client.get("/api/v1/media/1/image")
    assert result.status_code == 422
    assert raw not in result.content


def test_missing_s3_object_returns_helpful_error(setup):
    client, _, _, store, _ = setup
    login(client)
    store.get_object.side_effect = ClientError({"Error": {"Code": "NoSuchKey"}}, "GetObject")
    assert client.get("/api/v1/media/1/image").status_code == 404


def test_logout_removes_media_access(setup):
    client, _, _, _, _ = setup
    login(client)
    assert client.post("/api/v1/auth/logout").status_code == 200
    assert client.get("/api/v1/media/1/image").status_code == 401


def test_integrity_mismatch_rejected(setup):
    client, _, cur, _, _ = setup
    login(client)
    row = cur.fetchone.return_value
    cur.fetchone.return_value = (*row[:3], "00" * 32)
    assert client.get("/api/v1/media/1/image").status_code == 422


def test_expired_session_cannot_view_media(setup):
    client, _, _, store, _ = setup
    login(client)
    with patch.object(auth.time, "time", return_value=9999999999):
        assert client.get("/api/v1/media/1/image").status_code == 401
    store.get_object.assert_not_called()
