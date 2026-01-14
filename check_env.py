
import os
from dotenv import load_dotenv

basedir = os.path.abspath(os.path.join(os.path.dirname(__file__), 'server'))
env_path = os.path.join(basedir, '.env')

print(f"Loading .env from: {env_path}")
load_dotenv(env_path, override=True)

keys_to_check = ['OPENAI_API_KEY', 'GEMINI_API_KEY', 'ANTHROPIC_API_KEY']

print("-" * 30)
for key in keys_to_check:
    value = os.getenv(key)
    if value:
        masked_value = value[:8] + "..." + value[-4:] if len(value) > 12 else "****"
        print(f"{key}: LOADED ({masked_value})")
    else:
        print(f"{key}: MISSING")
print("-" * 30)
