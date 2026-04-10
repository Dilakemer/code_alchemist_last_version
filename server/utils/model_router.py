
class ModelRouter:
    """
    Routes requests to the most appropriate model based on:
    1. Programming Language (highest priority)
    2. Intent / Complexity (6 granular categories)
    3. User Preferences

    Intent → Model Map:
    ┌─────────────────┬──────────────────────────────┬────────────────────────────────────────┐
    │ Intent          │ Model                        │ Examples                               │
    ├─────────────────┼──────────────────────────────┼────────────────────────────────────────┤
    │ simple          │ GPT-4o-mini                  │ "What is X?", summaries, quick answers │
    │ simple_code     │ Gemini 2.5 Flash Lite        │ Basic loops, sorting, small functions  │
    │ debug           │ GPT-4o                       │ Error fixing, traceback analysis       │
    │ explain         │ Claude Sonnet                 │ "Explain SOLID", "How does X work?"    │
    │ architecture    │ Claude Opus 4.5              │ System design, complex refactoring     │
    │ creative        │ Claude Opus 4.5              │ Writing, storytelling, brainstorming   │
    │ general         │ Gemini 2.5 Flash Lite        │ Greetings, off-topic, general chat     │
    └─────────────────┴──────────────────────────────┴────────────────────────────────────────┘

    Language-Based Routing (overrides intent):
    - Python, Java, C#, SQL, Kotlin, Swift → GPT-4o
    - JavaScript, TypeScript, Rust, Go, PHP, Ruby, C, C++ → Claude Sonnet (not Opus!)
    - Bash/Shell → Gemini 2.5 Flash Lite
    """

    # Claude 4.5 model names
    CLAUDE_SONNET = 'claude-sonnet-4-5'
    CLAUDE_OPUS   = 'claude-opus-4-5'

    def __init__(self, default_model='gemini-3.1-flash-lite-preview'):
        self.default_model = default_model

    def route(self, language: str, intent: str, user_prefs: dict = None) -> tuple[str, str]:
        """
        Returns (model_name, reasoning)
        """
        user_prefs = user_prefs or {}
        preferred_model = user_prefs.get('preferred_model', 'auto')

        # ── 1. User Preference Override (Highest Priority) ───────────────────
        if preferred_model != 'auto':
            model_type_map = {
                'claude': self.CLAUDE_SONNET,    # Prefer Sonnet, not Opus, as default Claude
                'gemini': 'gemini-3.1-flash-lite-preview',
                'gpt':    'gpt-4o'
            }
            chosen = model_type_map.get(preferred_model, preferred_model)
            return chosen, f"⚙️ User preferred model manually selected: **{chosen}**."

        # ── 2. Language-Based Routing ──────────────────────────────────────────
        if language == 'python':
            return 'gpt-4o', "🐍 Python: **GPT-4o** chosen (Best for Python debugging & data science)."

        elif language in ['java', 'csharp', 'sql', 'kotlin', 'swift']:
            return 'gpt-4o', f"☕ Enterprise ({language}): **GPT-4o** chosen for robustness."

        # Web & Systems: GPT-4o by default, Opus only for complex architecture
        elif language in ['javascript', 'typescript', 'html', 'css', 'cpp', 'c', 'rust', 'go', 'php', 'ruby']:
            if intent == 'architecture':
                return self.CLAUDE_OPUS, f"🏗️ Complex Web/System Architecture ({language}): **Claude Opus 4.5** chosen."
            return 'gpt-4o', f"💻 {language}: **GPT-4o** chosen (Claude quota protected)."

        elif language == 'bash':
            return 'gemini-3.1-flash-lite-preview', "🐚 Bash/Shell: **Gemini 3.1 Flash Lite Preview** chosen (Fast for DevOps & scripting)."

        # ── 3. Intent-Based Routing ───────────────────────────────────────────

        # Simple questions, summaries, quick facts → GPT-4o-mini (fastest & cheapest)
        if intent == 'simple':
            return 'gpt-4o-mini', "⚡ Simple Query: **GPT-4o-mini** chosen (Fast & efficient for short answers)."

        # Basic algorithms, trivial code gen → Gemini 2.5 Flash Lite (free tier, fast)
        elif intent == 'simple_code':
            return 'gemini-3.1-flash-lite-preview', "🔹 Simple Code: **Gemini 3.1 Flash Lite Preview** chosen (Fast for basic algorithms)."

        # Debugging, error tracing → GPT-4o (best at structured error analysis)
        elif intent == 'debug':
            return 'gpt-4o', "🔍 Debugging: **GPT-4o** chosen (Best for error analysis & debugging)."

        # Explanations → GPT-4o-mini for standard; Claude Sonnet only for architecture-level depth
        elif intent == 'explain':
            if user_prefs.get('depth') == 'deep':
                return self.CLAUDE_SONNET, "📖 Deep Explanation: **Claude Sonnet** chosen (Thorough analysis)."
            return 'gpt-4o-mini', "📖 Explanation: **GPT-4o-mini** chosen (Fast & clear for standard explanations)."

        # Architecture/complex design → Claude Opus 4.5 only when truly needed
        elif intent == 'architecture':
            return self.CLAUDE_OPUS, "🏗️ Architecture: **Claude Opus 4.5** chosen (Best for complex system design)."

        # Creative writing → GPT-4o (creative, versatile)
        elif intent == 'creative':
            return 'gpt-4o', "🎨 Creative: **GPT-4o** chosen for writing & creativity."

        # Image generation
        elif intent == 'image_generation':
            return 'dall-e-3', "🎨 Image Generation: **DALL-E 3** chosen."

        # ── 4. Default Fallback ───────────────────────────────────────────────
        return self.default_model, "🚀 General Query: **Gemini 3.1 Flash Lite Preview** (Best free-tier quota & fast)."

