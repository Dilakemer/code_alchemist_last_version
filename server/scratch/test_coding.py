import httpx
import json

def test_coding_optimize():
    url = "http://127.0.0.1:5001/agent/run/sync"
    payload = {
        "question": "Write a python script that calculates the factorial of a number.",
        "model": "gemini-3-flash-preview",
        "provider": "gemini",
        "stream": False,
        "agent_mode": True
    }
    
    print(f"Sending request to {url}...")
    try:
        with httpx.Client(timeout=60.0) as client:
            response = client.post(url, json=payload)
            
        print(f"Status Code: {response.status_code}")
        if response.status_code == 200:
            result = response.json()
            print("\n--- Agent Response ---")
            print(result.get("text"))
            print("\n--- Metadata ---")
            print(f"Intent: {result.get('intent', 'N/A')}")
            print(f"Steps: {result.get('total_steps')}")
        else:
            print(f"Error: {response.text}")
    except Exception as e:
        print(f"Failed to connect: {e}")

if __name__ == "__main__":
    test_coding_optimize()
