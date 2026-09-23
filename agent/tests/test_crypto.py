from src.core.crypto_engine import CryptoEngine

def test_encryption_roundtrip():
    key = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    engine = CryptoEngine(key)
    sample_data = b"Pre-encrypted Diagnostic Buffer Content"
    
    ciphertext, nonce_hex, h = engine.encrypt_bytes(sample_data)
    assert ciphertext != sample_data

    decrypted = engine.decrypt_bytes(ciphertext, nonce_hex)
    assert decrypted == sample_data