"""Test claude-opus-4-5 availability"""
import os
import anthropic
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv('ANTHROPIC_API_KEY')
if not api_key:
    print("ANTHROPIC_API_KEY not found")
    exit()

client = anthropic.Anthropic(api_key=api_key)

# Test claude-opus-4-5
for model_id in ['claude-opus-4-5', 'claude-3-opus-20240229', 'claude-3-5-haiku-20241022', 'claude-3-5-sonnet-20241022']:
    try:
        resp = client.messages.create(
            model=model_id,
            max_tokens=10,
            messages=[{"role": "user", "content": "hi"}]
        )
        print(f"OK: {model_id}")
        break
    except Exception as e:
        print(f"FAIL: {model_id} -> {e}")
