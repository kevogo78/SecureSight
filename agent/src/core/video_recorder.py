"""Bounded default-screen MP4 recording; plaintext stays in memory."""
import io
import os
import subprocess
import threading
import time
from datetime import datetime, timezone
from PIL import ImageGrab, ImageOps

MAX_BYTES = 16 * 1024 * 1024 - 16


def capture_clip(cancel, allowed, duration=15, fps=2, frame_provider=None, size=(1280, 720)):
    import imageio_ffmpeg
    if not (0 < duration <= 30 and 1 <= fps <= 5):
        raise ValueError("Recording duration/fps exceeds limits")
    if cancel.is_set() or not allowed():
        return None
    started = datetime.now(timezone.utc).isoformat()
    width, height = size
    command = [imageio_ffmpeg.get_ffmpeg_exe(), '-hide_banner', '-loglevel', 'error',
               '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{width}x{height}',
               '-r', str(fps), '-i', 'pipe:0', '-an', '-c:v', 'libx264',
               '-threads', '1', '-preset', 'ultrafast', '-crf', '28', '-pix_fmt', 'yuv420p',
               '-movflags', 'frag_keyframe+empty_moov', '-f', 'mp4', 'pipe:1']
    process = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                               stderr=subprocess.DEVNULL,
                               creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
    data = io.BytesIO()
    overflow = threading.Event()
    finished = threading.Event()

    def watch_cancel():
        while not finished.wait(.05):
            if cancel.is_set():
                if process.poll() is None:
                    process.kill()
                return

    def drain():
        while True:
            block = process.stdout.read(65536)
            if not block:
                break
            if data.tell() + len(block) > MAX_BYTES:
                overflow.set()
                process.kill()
                break
            data.write(block)

    reader = threading.Thread(target=drain, daemon=True)
    reader.start()
    cancellation = threading.Thread(target=watch_cancel, daemon=True)
    cancellation.start()
    watchdog = threading.Timer(duration + 20, lambda: process.kill() if process.poll() is None else None)
    watchdog.daemon = True
    watchdog.start()
    next_frame = time.monotonic()
    count = int(duration * fps)
    grab = frame_provider or (lambda: ImageGrab.grab(all_screens=False))
    try:
        for _ in range(count):
            while time.monotonic() < next_frame:
                if cancel.wait(min(.1, max(0, next_frame - time.monotonic()))) or not allowed():
                    return None
            if cancel.is_set() or not allowed():
                return None
            frame = ImageOps.pad(grab().convert('RGB'), size)
            if cancel.is_set() or not allowed():
                return None
            process.stdin.write(frame.tobytes())
            next_frame += 1 / fps
        process.stdin.close()
        code = process.wait(timeout=10)
        reader.join(timeout=3)
        if code or reader.is_alive() or overflow.is_set():
            raise RuntimeError("Video encoder failed or capture exceeded size limit")
        if cancel.is_set() or not allowed():
            return None
        video = data.getvalue()
        if video[4:8] != b'ftyp':
            raise RuntimeError("Encoder did not produce an MP4")
        return video, {"started_at": started, "duration_seconds": count / fps,
                       "fps": fps, "width": width, "height": height}
    finally:
        finished.set()
        watchdog.cancel()
        if process.poll() is None:
            process.kill()
        process.wait(timeout=5)
        reader.join(timeout=3)
        cancellation.join(timeout=1)
        process.stdout.close()
        if not process.stdin.closed:
            try:
                process.stdin.close()
            except OSError:
                pass
        data.close()


class RecordingWorker:
    def __init__(self, allowed, crypto, api, endpoint_id, status, capture=capture_clip):
        self.allowed, self.crypto, self.api = allowed, crypto, api
        self.endpoint_id, self.status, self.capture = endpoint_id, status, capture
        self.thread = None
        self.cancel_event = threading.Event()

    def start(self):
        if self.thread and self.thread.is_alive():
            return False
        if not self.allowed():
            return False
        self.cancel_event = threading.Event()
        self.thread = threading.Thread(target=self._run, args=(self.cancel_event,), daemon=True)
        self.thread.start()
        return True

    def cancel(self):
        self.cancel_event.set()
        if self.thread and self.thread is not threading.current_thread():
            self.thread.join(timeout=2)

    def _run(self, cancel):
        try:
            self.status("Recording 15-second clip")
            result = self.capture(cancel, self.allowed)
            if result is None or cancel.is_set() or not self.allowed():
                return
            video, metadata = result
            encrypted, iv, digest = self.crypto.encrypt_bytes(video)
            self.status("Uploading encrypted clip")
            payload = {**metadata, "endpoint_id": self.endpoint_id, "encryption_iv": iv,
                       "file_hash": digest, "encrypted_size": len(encrypted)}
            upload = self.api.request_recording_upload(payload)
            if not upload or cancel.is_set() or not self.allowed():
                return
            if not self.api.upload_encrypted_media(upload['upload_url'], encrypted):
                return
            if cancel.is_set() or not self.allowed():
                return
            if self.api.confirm_media_upload(upload['complete_path']):
                print(f"Encrypted video uploaded and verified ({upload['recording_id']})")
        except Exception as error:
            print(f"Video recording failed: {type(error).__name__}. Check encoder/API configuration.")
        finally:
            self.status("Idle; clips every 5 minutes")
