import os
from google import genai
from dotenv import load_dotenv

load_dotenv('server/.env')

api_key = os.getenv('GEMINI_API_KEY')
client = genai.Client(api_key=api_key)

models_to_test = [
    'gemini-1.5-flash',
    'gemini-2.0-flash-exp',
    'gemini-3.1-flash-lite-preview',
    'gemini-2.5-flash'
]

for model in models_to_test:
    print(f"Testing model: {model}")
    try:
        response = client.models.generate_content(
            model=model,
            contents='Hello'
        )
        print(f"  SUCCESS: {response.text[:50]}...")
    except Exception as e:
        print(f"  ERROR: {e}")
