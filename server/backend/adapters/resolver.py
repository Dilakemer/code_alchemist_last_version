from __future__ import annotations
import os
from typing import Optional, Dict, Tuple
import httpx
from models import UserExternalApiKey, db
from utils.crypto_utils import decrypt_key

class ProviderResolver:
    """
    Central resolver for AI provider keys and validation.
    """
    
    @staticmethod
    def get_user_key(user_id: int, provider: str) -> Optional[str]:
        """Fetches and decrypts a user's API key for a specific provider."""
        record = UserExternalApiKey.query.filter_by(
            user_id=user_id, 
            provider=provider.lower(), 
            is_active=True
        ).first()
        
        if record:
            try:
                return decrypt_key(record.encrypted_key)
            except Exception as e:
                print(f"[ProviderResolver] Decryption failed for user {user_id}, provider {provider}: {e}")
                return None
        return None

    @staticmethod
    def validate_key(provider: str, api_key: str) -> Tuple[bool, str]:
        """
        Validates an API key by making a minimal request to the provider.
        Returns (True, "") if valid, (False, "error message") otherwise.
        """
        provider = provider.lower()
        try:
            with httpx.Client(timeout=10.0) as client:
                if provider == "openai":
                    # Simple models list call
                    resp = client.get(
                        "https://api.openai.com/v1/models",
                        headers={"Authorization": f"Bearer {api_key}"}
                    )
                    if resp.status_code == 200:
                        return True, ""
                    return False, f"OpenAI returned {resp.status_code}: {resp.text}"
                
                elif provider == "anthropic":
                    # Minimal message call
                    resp = client.post(
                        "https://api.anthropic.com/v1/messages",
                        headers={
                            "x-api-key": api_key,
                            "anthropic-version": "2023-06-01",
                            "content-type": "application/json"
                        },
                        json={
                            "model": "claude-3-haiku-20240307",
                            "max_tokens": 1,
                            "messages": [{"role": "user", "content": "hi"}]
                        }
                    )
                    # 401 Unauthorized or 403 Forbidden means invalid key
                    if resp.status_code in (401, 403):
                        return False, f"Anthropic returned {resp.status_code}: {resp.text}"
                    return True, ""

                elif provider == "gemini":
                    # Minimal models list call
                    resp = client.get(
                        f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
                    )
                    if resp.status_code == 200:
                        return True, ""
                    return False, f"Gemini returned {resp.status_code}: {resp.text}"
                
        except Exception as e:
            print(f"[ProviderResolver] Validation error for {provider}: {e}")
            return False, str(e)
            
        return False, "Unknown provider"
