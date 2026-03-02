
class ModelRouter:
    """
    Routes the user request to the most appropriate AI model based on:
    1. Programming Language (specific models excel at specific languages)
    2. Intent (Code vs. Creative vs. Logic)
    3. User Preferences (Saved favorite models)
    """

    def __init__(self, default_model='gemini-1.5-flash'):
        self.default_model = default_model

    def route(self, language: str, intent: str, user_prefs: dict = None) -> tuple[str, str]:
        """
        Returns (model_name, reasoning)
        """
        user_prefs = user_prefs or {}
        preferred_model = user_prefs.get('preferred_model', 'auto')

        # 1. User Preference Override (if strict preference is set)
        if preferred_model != 'auto' and intent in ['code', 'general']:
            model_type_map = {
                'claude': 'claude-opus-4-5',
                'gemini': 'gemini-1.5-pro',
                'gpt': 'gpt-4o'
            }
            chosen = model_type_map.get(preferred_model, preferred_model)
            return chosen, f"⚙️ Auto-routing active. Detected intent: **{intent}**. Using: **{chosen}**."

        # 2. Intent-Based Routing
        if intent == 'creative':
            return 'gemini-1.5-flash', "🎨 Creative Task: **Gemini 1.5 Flash** chosen for creativity."
        
        elif intent == 'logic':
            return 'gpt-4o', "🧠 Complex Logic: **GPT-4o** chosen for reasoning capabilities."

        elif intent == 'image_generation':
            return 'dall-e-3', "🎨 Image Generation: **DALL-E 3** chosen."

        # 3. Language-Based Routing (The core "Auto-Router")
        if language == 'python':
            return 'gemini-1.5-flash', "🐍 Python: **Gemini 1.5 Flash** chosen (Fast & Capable)."
        
        elif language in ['java', 'csharp', 'sql', 'kotlin', 'swift']:
            return 'gpt-4o', f"☕ Enterprise Language ({language}): **GPT-4o** chosen for robustness."
        
        elif language in ['javascript', 'typescript', 'html', 'css', 'cpp', 'c', 'rust', 'go']:
            return 'claude-opus-4-5', f"💻 Systems/Web ({language}): **Claude Opus 4.5** chosen (State-of-the-art for coding)."

        # 4. Default / General Fallback
        return self.default_model, "🚀 General Query: **Gemini 1.5 Flash** (Balanced & Fast)."
