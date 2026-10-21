import hashlib
import io
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

with patch('psycopg2.pool.ThreadedConnectionPool'), patch('psycopg2.pool.SimpleConnectionPool'), patch('boto3.client'):
    from src.routes import recordings, auth

RID = '12345678-1234-1234-1234-123456789abc'


@pytest.fixture
def context(monkeypatch):
    monkeypatch.setenv('DASHBOARD_SESSION_SECRET', 's' * 64)
    monkeypatch.setenv('DASHBOARD_ADMIN_PASSWORD', 'test-pass')
    monkeypatch.setenv('DASHBOARD_COOKIE_SECURE', 'false')
    monkeypatch.setenv('SCREENSHOT_KEY_HEX', '01' * 32)
    app = FastAPI()
    app.include_router(auth.router)
    app.include_router(recordings.router)
    conn = MagicMock()
    cur = conn.cursor.return_value.__enter__.return_value
    cur.fetchone.return_value = (True,)
    client = TestClient(app)
    store = MagicMock()
    with patch.object(recordings, 'get_db_connection') as db, patch.object(recordings, 's3_client', store), patch.object(recordings, 'generate_upload_url', return_value='https://example.invalid/upload'):
        db.return_value.__enter__.return_value = conn
        yield client, cur, store, conn


def login(client):
    assert client.post('/api/v1/auth/login', json={'username': 'administrator', 'password': 'test-pass'}).status_code == 200


def payload():
    return {'endpoint_id': 42, 'started_at': '2026-10-21T12:00:00Z', 'duration_seconds': 15,
            'fps': 2, 'width': 1280, 'height': 720, 'encryption_iv': '01' * 12,
            'file_hash': '02' * 32, 'encrypted_size': 1024}


def test_upload_metadata_uses_recordings_prefix(context):
    client, cur, _, conn = context
    response = client.post('/api/v1/recordings/upload-url', json=payload())
    assert response.status_code == 200
    params = cur.execute.call_args.args[1]
    assert params[8].startswith('recordings/42/')
    assert params[8].endswith('.mp4.enc')
    conn.commit.assert_called_once()


def test_limits_and_unregistered_endpoint(context):
    client, cur, _, _ = context
    assert client.post('/api/v1/recordings/upload-url', json={**payload(), 'duration_seconds': 300}).status_code == 422
    cur.fetchone.return_value = None
    assert client.post('/api/v1/recordings/upload-url', json=payload()).status_code == 403


def test_list_and_playback_require_real_login(context):
    client, cur, store, _ = context
    assert client.get('/api/v1/recordings?endpoint_id=42').status_code == 401
    assert client.get(f'/api/v1/recordings/{RID}/video').status_code == 401
    cur.execute.assert_not_called()
    store.get_object.assert_not_called()


def test_completed_list_excludes_pending_and_maps_endpoint(context):
    client, cur, _, _ = context
    login(client)
    cur.fetchall.return_value = [(RID, datetime.now(timezone.utc), 15, 2, 1280, 720)]
    response = client.get('/api/v1/recordings?endpoint_id=42')
    assert response.status_code == 200
    assert response.json()[0]['video_url'].endswith(f'{RID}/video')
    assert "status = 'uploaded'" in cur.execute.call_args.args[0]
    assert cur.execute.call_args.args[1] == (42, 50)


def test_confirm_requires_matching_s3_size(context):
    client, cur, store, conn = context
    cur.fetchone.return_value = ('bucket', 'recordings/42/file.mp4.enc', 1024)
    store.head_object.return_value = {'ContentLength': 12}
    assert client.post(f'/api/v1/recordings/{RID}/complete').status_code == 409
    conn.rollback.assert_called_once()
    store.head_object.return_value = {'ContentLength': 1024}
    assert client.post(f'/api/v1/recordings/{RID}/complete').status_code == 200


def encrypted_video(cur, store):
    video = b'\x00\x00\x00\x18ftypisom-synthetic-test'
    nonce = b'n' * 12
    ciphertext = AESGCM(bytes.fromhex('01' * 32)).encrypt(nonce, video, None)
    cur.fetchone.return_value = ('bucket', 'file.mp4.enc', nonce.hex(), hashlib.sha256(video).hexdigest(), len(ciphertext))
    store.get_object.return_value = {'Body': io.BytesIO(ciphertext), 'ContentLength': len(ciphertext)}
    return video


def test_playback_decrypts_and_does_not_cache(context):
    client, cur, store, _ = context
    login(client)
    video = encrypted_video(cur, store)
    response = client.get(f'/api/v1/recordings/{RID}/video')
    assert response.status_code == 200
    assert response.content == video
    assert response.headers['content-type'] == 'video/mp4'
    assert 'no-store' in response.headers['cache-control']


def test_wrong_key_never_returns_video(context, monkeypatch):
    client, cur, store, _ = context
    login(client)
    video = encrypted_video(cur, store)
    monkeypatch.setenv('SCREENSHOT_KEY_HEX', '03' * 32)
    response = client.get(f'/api/v1/recordings/{RID}/video')
    assert response.status_code == 422
    assert video not in response.content


def test_database_failure_is_visible(context):
    client, cur, _, _ = context
    cur.execute.side_effect = RuntimeError('unavailable')
    assert client.post('/api/v1/recordings/upload-url', json=payload()).status_code == 503
