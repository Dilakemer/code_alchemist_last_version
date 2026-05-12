import httpx
import json

def test_optimize():
    url = "http://127.0.0.1:5001/agent/run/sync"
    payload = {
        "question": "List the files in the server directory and explain what app.py does.",
        "model": "gemini-3-flash-preview",
        "provider": "gemini",
        "stream": False,
        "agent_mode": True
    }
    
    print(f"Sending request to {url}...")
    try:
        # We need to set a long timeout because the agent might take a while
        with httpx.Client(timeout=60.0) as client:
            response = client.post(url, json=payload)
            
        print(f"Status Code: {response.status_code}")
        if response.status_code == 200:
            result = response.json()
            print("\n--- Optimized Prompt (from result meta if available, or implied by trace) ---")
            # Note: The sync result might not return the optimized prompt directly in the JSON
            # unless we added it to the response. 
            # Let's check AgentSyncResult in schemas.py
            print(json.dumps(result, indent=2))
        else:
            print(f"Error: {response.text}")
    except Exception as e:
        print(f"Failed to connect: {e}")

if __name__ == "__main__":
    test_optimize()
