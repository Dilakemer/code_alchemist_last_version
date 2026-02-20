
import requests
import json
import sys

BASE_URL = "http://127.0.0.1:5000/api/ask"

def test_prompt(name, prompt, model="auto"):
    print(f"\n--- Testing: {name} ---")
    print(f"Prompt: {prompt[:50]}...")
    
    try:
        response = requests.post(BASE_URL, json={
            "question": prompt,
            "model": model,
            "no_save": False
        }, stream=True)
        
        routing_reason = None
        
        for line in response.iter_lines():
            if line:
                decoded_line = line.decode('utf-8')
                if decoded_line.startswith("data: "):
                    json_str = decoded_line[6:]
                    try:
                        data = json.loads(json_str)
                        if data.get('routing_reason'):
                            routing_reason = data.get('routing_reason')
                    except:
                        pass
        
        if routing_reason:
            print(f"✅ Result: {routing_reason}")
        else:
            print("❌ Could not find routing reason in response.")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    print(f"Checking API at {BASE_URL}...")
    
    # 1. Tricky Python Request (No "def", "import", "print")
    # This relies on the LLM fallback because it doesn't have standard keywords
    test_prompt("Tricky Python", "How do I reverse a list using slicing syntax? [::-1]")
    
    # 2. Standard Java
    test_prompt("Standard Java", "public class Main { public static void main(String[] args) {} }")
