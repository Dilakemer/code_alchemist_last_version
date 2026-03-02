
class ModelRouter:
    """
    Routes the user request to the most appropriate AI model based on:
    1. Programming Language (specific models excel at specific languages)
    2. Intent (Code vs. Creative vs. Logic)
    3. User Preferences (Saved favorite models)

    Routing Map:
    - Python            → GPT-4o (excellent Python debugger & explainer)
    - JS/TS/Web/Systems → Claude Opus 4.5 (best for modern web & systems code)
    - Java/C#/SQL/Kotlin/Swift → GPT-4o (enterprise-grade robustness)
    - PHP/Ruby/Go/Rust  → Claude Opus 4.5
    - Bash/Shell        → Gemini 1.5 Flash (fast for DevOps/Shell tasks)
    - Creative          → Claude Opus 4.5 (writing + creative)
    - Logic/Math        → GPT-4o
    - General/Unknown   → Gemini 1.5 Flash
    """

    def __init__(self, default_model='gemini-1.5-flash'):
        self.default_model = default_model

    def route(self, language: str, intent: str, user_prefs: dict = None) -> tuple[str, str]:
        """
        Returns (model_name, reasoning)
        """
        user_prefs = user_prefs or {}
        preferred_model = user_prefs.get('preferred_model', 'auto')

        # 1. User Preference Override (only when user explicitly chose a provider)
        if preferred_model != 'auto' and intent in ['code', 'general']:
            model_type_map = {
                'claude': 'claude-opus-4-5',
                'gemini': 'gemini-1.5-flash',
                'gpt': 'gpt-4o'
            }
            chosen = model_type_map.get(preferred_model, preferred_model)
            return chosen, f"⚙️ Auto-routing active. Detected language: **{language}** | Using: **{chosen}**."

        # 2. Intent-Based Routing (when no specific language detected)
        if intent == 'creative':
            return 'claude-opus-4-5', "🎨 Creative Task: **Claude Opus 4.5** chosen for writing & creativity."

        elif intent == 'logic':
            return 'gpt-4o', "🧠 Complex Logic/Math: **GPT-4o** chosen for reasoning capabilities."

        elif intent == 'image_generation':
            return 'dall-e-3', "🎨 Image Generation: **DALL-E 3** chosen."

        # 3. Language-Based Routing (The core "Auto-Router")

        # Python: GPT-4o excels at Python debugging, data science, and clear explanations
        if language == 'python':
            return 'gpt-4o', "🐍 Python: **GPT-4o** chosen (Best for Python debugging & data science)."

        # Enterprise Languages: GPT-4o for Java, C#, SQL, Kotlin, Swift
        elif language in ['java', 'csharp', 'sql', 'kotlin', 'swift']:
            return 'gpt-4o', f"☕ Enterprise Language ({language}): **GPT-4o** chosen for robustness."

        # Web & Systems: Claude Opus 4.5 for modern web, TypeScript, C++, Rust, Go
        elif language in ['javascript', 'typescript', 'html', 'css', 'cpp', 'c', 'rust', 'go', 'php', 'ruby']:
            return 'claude-opus-4-5', f"💻 Web/Systems ({language}): **Claude Opus 4.5** chosen (State-of-the-art for coding)."

        # Bash/Shell/DevOps: Gemini is fast and reliable for shell commands
        elif language == 'bash':
            return 'gemini-1.5-flash', "🐚 Bash/Shell: **Gemini 1.5 Flash** chosen (Fast for DevOps & scripting)."

        # 4. Default / General Fallback → Gemini (quota allowing)
        return self.default_model, "🚀 General Query: **Gemini 1.5 Flash** (Balanced & Fast)."
