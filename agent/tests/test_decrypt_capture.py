import io

from cryptography.exceptions import InvalidTag
from PIL import Image
import pytest

from decrypt_capture import decrypt_capture
from src.core.crypto_engine import CryptoEngine


def capture(tmp_path):
    key = "01" * 32
    buffer = io.BytesIO()
    Image.new("RGB", (4, 4), "blue").save(buffer, format="JPEG")
    encrypted, iv, digest = CryptoEngine(key).encrypt_bytes(buffer.getvalue())
    path = tmp_path / "capture.enc"
    path.write_bytes(encrypted)
    return path, key, iv, digest, buffer.getvalue()


def test_decrypts_real_jpeg_and_checks_hash(tmp_path):
    path, key, iv, digest, raw = capture(tmp_path)
    output = tmp_path / "capture.jpg"
    decrypt_capture(path, output, iv, key, digest)
    assert output.read_bytes() == raw
    with Image.open(output) as image:
        assert image.size == (4, 4)


def test_wrong_key_does_not_write_output(tmp_path):
    path, _, iv, digest, _ = capture(tmp_path)
    output = tmp_path / "capture.jpg"
    with pytest.raises(InvalidTag):
        decrypt_capture(path, output, iv, "02" * 32, digest)
    assert not output.exists()


def test_refuses_overwrite_and_wrong_hash(tmp_path):
    path, key, iv, digest, _ = capture(tmp_path)
    output = tmp_path / "capture.jpg"
    with pytest.raises(ValueError, match="file_hash"):
        decrypt_capture(path, output, iv, key, "00" * 32)
    assert not output.exists()
    output.write_bytes(b"keep")
    with pytest.raises(FileExistsError):
        decrypt_capture(path, output, iv, key, digest)
    assert output.read_bytes() == b"keep"
