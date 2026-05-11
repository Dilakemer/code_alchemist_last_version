import os
from cryptography.fernet import Fernet

def _get_encryption_key():
    """
    Retrieves the encryption key from environment variables.
    If not found, it generates a temporary one (not recommended for production).
    """
    key = os.getenv("ENCRYPTION_KEY")
    if not key:
        # Warning: In a real app, you should set this in .env
        # We generate one here to avoid crashing, but it means keys won't be
        # decryptable after a restart if the key isn't persisted.
        print("[WARNING] ENCRYPTION_KEY not found in environment. Generating a temporary one.")
        return Fernet.generate_key()
    return key.encode()

def encrypt_key(plain_text: str) -> str:
    """Encrypts a plain text string."""
    if not plain_text:
        return ""
    f = Fernet(_get_encryption_key())
    return f.encrypt(plain_text.encode()).decode()

def decrypt_key(encrypted_text: str) -> str:
    """Decrypts an encrypted string."""
    if not encrypted_text:
        return ""
    f = Fernet(_get_encryption_key())
    return f.decrypt(encrypted_text.encode()).decode()

def mask_key(api_key: str) -> str:
    """Masks an API key for safe display (e.g., 'sk-...abcd')."""
    if not api_key:
        return ""
    if len(api_key) <= 8:
        return "****"
    return f"{api_key[:4]}...{api_key[-4:]}"
