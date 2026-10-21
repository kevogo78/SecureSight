import subprocess
import threading
from unittest.mock import MagicMock

import imageio_ffmpeg
from PIL import Image

from src.core.crypto_engine import CryptoEngine
from src.core.video_recorder import capture_clip, RecordingWorker


def test_encodes_actual_h264_mp4_from_synthetic_frames():
    video, metadata = capture_clip(threading.Event(), lambda: True,
                                   duration=1, fps=2, size=(64, 64),
                                   frame_provider=lambda: Image.new('RGB', (64, 64), 'green'))
    assert video[4:8] == b'ftyp'
    assert metadata['duration_seconds'] == 1
    decoded = subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), '-v', 'error', '-i', 'pipe:0',
                              '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'],
                             input=video, capture_output=True, timeout=10)
    assert decoded.returncode == 0, decoded.stderr
    assert len(decoded.stdout) == 64 * 64 * 3 * 2


def test_cancelled_capture_does_not_grab_screen():
    event = threading.Event()
    event.set()
    grab = MagicMock()
    assert capture_clip(event, lambda: True, frame_provider=grab) is None
    grab.assert_not_called()


def test_sensitive_change_discards_entire_partial_clip():
    safe = True
    def grab():
        nonlocal safe
        safe = False
        return Image.new('RGB', (64, 64))
    assert capture_clip(threading.Event(), lambda: safe, duration=1, size=(64, 64), frame_provider=grab) is None


def test_worker_encrypts_before_upload_and_confirms():
    engine = CryptoEngine('01' * 32)
    api = MagicMock()
    api.request_recording_upload.return_value = {'recording_id': 'abc', 'upload_url': 'https://example.invalid', 'complete_path': '/api/v1/recordings/abc/complete'}
    api.upload_encrypted_media.return_value = True
    api.confirm_media_upload.return_value = True
    raw = b'\x00\x00\x00\x18ftypisom-synthetic'
    worker = RecordingWorker(lambda: True, engine, api, 42, lambda _: None,
                             capture=lambda *_: (raw, {'fps': 2}))
    assert worker.start()
    worker.thread.join(timeout=3)
    assert not worker.thread.is_alive()
    payload = api.request_recording_upload.call_args.args[0]
    encrypted = api.upload_encrypted_media.call_args.args[1]
    assert encrypted != raw
    assert engine.decrypt_bytes(encrypted, payload['encryption_iv']) == raw
    api.confirm_media_upload.assert_called_once()


def test_worker_cancellation_prevents_upload_and_overlapping_clips():
    entered = threading.Event()
    def capture(cancel, _):
        entered.set()
        cancel.wait(2)
        return None
    api = MagicMock()
    worker = RecordingWorker(lambda: True, CryptoEngine('01' * 32), api, 42, lambda _: None, capture)
    assert worker.start()
    assert entered.wait(1)
    assert not worker.start()
    worker.cancel()
    worker.thread.join(timeout=3)
    api.request_recording_upload.assert_not_called()


def test_orchestrator_checks_raw_title_and_respects_pause():
    from src.main import AgentOrchestrator
    agent = AgentOrchestrator.__new__(AgentOrchestrator)
    agent.stopping = False
    agent.is_suspended = False
    agent.tracker = MagicMock()
    agent.tracker.get_active_window.return_value = {
        'app_name': 'notepad.exe', 'window_title_raw': 'password=private',
        'window_title_sanitized': 'password=[REDACTED_SECRET]',
    }
    from src.core.privacy_filter import PrivacyFilter
    agent.privacy = PrivacyFilter()
    assert not agent.recording_allowed()
    agent.tracker.get_active_window.return_value['window_title_raw'] = 'Harmless demo'
    assert agent.recording_allowed()
    agent.is_suspended = True
    assert not agent.recording_allowed()
    agent.is_suspended = False
    agent.tracker.get_active_window.return_value['app_name'] = 'Unknown'
    assert not agent.recording_allowed()
