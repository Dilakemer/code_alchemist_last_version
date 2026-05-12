import httpx
import json

def test_model_specific_optimization():
    url = "http://127.0.0.1:5001/agent/run/sync"
    
    test_cases = [
        {"model": "gemini-3-flash-preview", "desc": "Gemini Optimization"},
        {"model": "claude-3-5-sonnet-20240620", "desc": "Claude Optimization"},
        {"model": "gpt-4o", "desc": "OpenAI Optimization"}
    ]
    
    for case in test_cases:
        print(f"\n=== Testing {case['desc']} (Model: {case['model']}) ===")
        payload = {
            "question": "Write a python script that calculates the factorial of a number.",
            "model": case["model"],
            "provider": "gemini" if "gemini" in case["model"] else ("anthropic" if "claude" in case["model"] else "openai"),
            "stream": False,
            "agent_mode": True
        }
        
        try:
            with httpx.Client(timeout=60.0) as client:
                response = client.post(url, json=payload)
                
            if response.status_code == 200:
                print("Success! (Check server logs for the optimized prompt structure)")
                # We can't see the optimized prompt in the response text easily 
                # unless we check the server logs, but the agent response should
                # reflect the constraints.
            else:
                print(f"Error: {response.status_code} - {response.text}")
        except Exception as e:
            print(f"Failed: {e}")

if __name__ == "__main__":
    test_model_specific_optimization()
