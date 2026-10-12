"""Decrypt a downloaded agent capture locally; never imports the live agent."""
import argparse
import ast
import hashlib
import io
import os
from pathlib import Path

from cryptography.exceptions import InvalidTag
from PIL import Image
from src.core.crypto_engine import CryptoEngine


def configured_key():
    override = os.environ.get("EDMT_CRYPTO_KEY_HEX")
    if override:
        return override
    # Read the current agent key without starting its UI or input listeners.
    source = Path(__file__).parent / "src" / "main.py"
    for node in ast.parse(source.read_text(encoding="utf-8")).body:
        if isinstance(node, ast.Assign) and any(
            isinstance(target, ast.Name) and target.id == "CONFIG" for target in node.targets
        ):
            return ast.literal_eval(node.value)["crypto_key_hex"]
    raise ValueError("Could not read the agent key; set EDMT_CRYPTO_KEY_HEX locally")


def decrypt_capture(input_path, output_path, iv, key, expected_hash=None):
    if len(bytes.fromhex(iv)) != 12:
        raise ValueError("The IV must be 24 hexadecimal characters (12 bytes)")
    plaintext = CryptoEngine(key).decrypt_bytes(Path(input_path).read_bytes(), iv)
    if expected_hash and hashlib.sha256(plaintext).hexdigest() != expected_hash.lower():
        raise ValueError("The decrypted capture does not match the database file_hash")
    with Image.open(io.BytesIO(plaintext)) as capture:
        if capture.format != "JPEG":
            raise ValueError("The decrypted capture is not the agent's expected JPEG image")
        capture.verify()
    # Refuse to overwrite an existing file.
    with Path(output_path).open("xb") as output:
        output.write(plaintext)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, help="Downloaded .enc file")
    parser.add_argument("--iv", required=True, help="encryption_iv from the matching database row")
    parser.add_argument("--output", type=Path, help="New .jpg file; defaults beside the input")
    parser.add_argument("--sha256", help="Optional file_hash from the matching database row")
    args = parser.parse_args()
    output = args.output or args.input.with_suffix(".jpg")
    try:
        decrypt_capture(args.input, output, args.iv, configured_key(), args.sha256)
    except InvalidTag:
        parser.exit(1, "Decryption failed: wrong key/IV, or damaged ciphertext. No image was written.\n")
    except (OSError, ValueError, KeyError, SyntaxError) as error:
        parser.exit(1, f"Could not decrypt capture: {error}\n")
    print(f"Screenshot saved to: {output.resolve()}")


if __name__ == "__main__":
    main()
