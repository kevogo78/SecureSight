import os
import hashlib
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

class CryptoEngine:
    def __init__(self, key_hex: str):
        self.key = bytes.fromhex(key_hex)
        self.aesgcm = AESGCM(self.key)

    def encrypt_bytes(self, raw_data: bytes):
        """
        Encrypts arbitrary bytes via AES-256-GCM.
        Returns:
            tuple: (ciphertext: bytes, iv_hex: str, sha256_hash: str)
        """
        nonce = os.urandom(12)  # 96-bit standard nonce for GCM
        ciphertext = self.aesgcm.encrypt(nonce, raw_data, None)
        file_hash = hashlib.sha256(raw_data).hexdigest()
        return ciphertext, nonce.hex(), file_hash

    def decrypt_bytes(self, ciphertext: bytes, nonce_hex: str) -> bytes:
        nonce = bytes.fromhex(nonce_hex)
        return self.aesgcm.decrypt(nonce, ciphertext, None)