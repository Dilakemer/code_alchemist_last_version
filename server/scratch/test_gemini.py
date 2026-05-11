import os
from google import genai
from dotenv import load_dotenv

load_dotenv('server/.env')

api_key = os.getenv('GEMINI_API_KEY')
print(f"API Key: {api_key[:10]}...")

client = genai.Client(api_key=api_key)

try:
    # Try a known model
    response = client.models.generate_content(
        model='gemini-1.5-flash',
        contents='Hello, respond with "OK" if you can hear me.'
    )
    print(f"Response (gemini-1.5-flash): {response.text}")
except Exception as e:
    print(f"Error (gemini-1.5-flash): {e}")

try:
    # Try the user's model
    user_model = os.getenv('GEMINI_MODEL_NAME')
    print(f"Trying user model: {user_model}")
    response = client.models.generate_content(
        model=user_model,
        contents='Hello, respond with "OK" if you can hear me.'
    )
    print(f"Response ({user_model}): {response.text}")
except Exception as e:
    print(f"Error ({user_model}): {e}")
