
class ModelRouter:
    """
    Routes the user request to the most appropriate AI model based on:
    1. Programming Language (specific models excel at specific languages)
    2. Intent (Code vs. Creative vs. Logic)
    3. User Preferences (Saved favorite models)
    """

    def __init__(self, default_model='gemini-2.5-flash'):
        self.default_model = default_model

    def route(self, language: str, intent: str, user_prefs: dict = None) -> tuple[str, str]:
        """
        Returns (model_name, reasoning)
        """
        user_prefs = user_prefs or {}
        preferred_model = user_prefs.get('preferred_model', 'auto')

        # 1. User Preference Override (if strict preference is set, though usually 'auto' is best)
        # We only override if intent is 'code' or 'general'. 
        # If it's something highly specific like 'image_generation', we might ignore preference.
        if preferred_model != 'auto' and intent in ['code', 'general']:
            model_type_map = {
                'claude': 'claude-sonnet-4-5-20250929',
                'gemini': 'gemini-2.5-pro',
                'gpt': 'gpt-4o'
            }
            # If the user has a preferred model key (e.g. 'claude'), map it to the actual model ID
            chosen = model_type_map.get(preferred_model, preferred_model)
            return chosen, f"User Preference: You prefer **{preferred_model}**."

        # 2. Intent-Based Routing
        if intent == 'creative':
            return 'gemini-3-flash-preview', "🎨 Creative Task: **Gemini 3 Flash** chosen for creativity."
        
        elif intent == 'logic':
            return 'gpt-4o', "🧠 Complex Logic: **GPT-4o** chosen for reasoning capabilities."

        elif intent == 'image_generation':
            return 'dall-e-3', "🎨 Image Generation: **DALL-E 3** chosen."

        # 3. Language-Based Routing (The core "Auto-Router")
        if language == 'python':
            return 'gemini-2.5-flash', "🐍 Python: **Gemini 2.5 Flash** chosen (Fast & Capable - Pro unavailable)."
        
        elif language in ['java', 'csharp', 'sql', 'kotlin', 'swift']:
            return 'gpt-4o', f"☕ Enterprise Language ({language}): **GPT-4o** chosen for robustness."
        
        elif language in ['javascript', 'typescript', 'html', 'css', 'cpp', 'c', 'rust', 'go']:
            return 'claude-sonnet-4-5-20250929', f"💻 Systems/Web ({language}): **Claude 3.5 Sonnet** chosen (State-of-the-art for coding)."

        # 4. Default / General Fallback
        return self.default_model, "🚀 General Query: **Gemini 2.5 Flash** (Balanced & Fast)."
