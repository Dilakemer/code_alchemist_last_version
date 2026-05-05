import os
from google import genai
from dotenv import load_dotenv

load_dotenv('server/.env')

api_key = os.getenv('GEMINI_API_KEY')
client = genai.Client(api_key=api_key)

try:
    print("Listing available models:")
    # The new SDK has a different way to list models, checking it.
    # Actually, let's just try to iterate them if possible.
    # For now, let's just try a few more standard ones.
    models_to_try = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash', 'gemini-2.0-pro']
    for m in models_to_try:
        try:
            res = client.models.generate_content(model=m, contents='Hi')
            print(f"  {m}: SUCCESS")
        except Exception as e:
            print(f"  {m}: {e}")
except Exception as e:
    print(f"Error listing: {e}")
