"""
Model-specific rules and constraints for the Prompt Optimizer.
Derived from research on modern system prompts (e.g., leaked prompts from major LLM providers).
"""

GEMINI_RULES = """
## Gemini Specific Rules
- **Thinking Process**: Think step-by-step before answering complex coding tasks.
- **Action Statement**: State your action in one sentence before providing the code update.
- **TypeScript Standards**: Prefer standard `enum` over `const enum`. Use top-level named imports.
- **Styling**: Favor Tailwind CSS and use `@import "tailwindcss"` if applicable.
- **Formatting**: Use structured markdown with clear headers (##, ###).
"""

CLAUDE_RULES = """
## Claude Specific Rules
- **Conciseness**: Be extremely concise and direct. Avoid emoticons, preambles, and filler phrases.
- **Engineering Strategy**: Prefer modifying existing files over creating new ones to minimize diff size.
- **Security**: Adhere strictly to OWASP Top 10 security standards.
- **Tone**: Maintain a professional, minimalist, and engineering-focused tone.
"""

OPENAI_RULES = """
## OpenAI Specific Rules
- **Aesthetic Excellence**: Focus on clean UI design with soft shadows, rounded corners, and grid-based layouts (Tailwind/Shadcn).
- **Engagement**: Match the user's tone and vibe. Be inquisitive and collaborative.
- **Python Data**: For data visualization, prefer Matplotlib and clean, individual plots.
"""

def get_rules_for_model(model_name: str) -> str:
    """Returns the optimization rules for the given model family."""
    m = (model_name or "").lower()
    if "gemini" in m:
        return GEMINI_RULES
    if "claude" in m or "anthropic" in m:
        return CLAUDE_RULES
    if "gpt" in m or "openai" in m or "o1" in m or "o3" in m:
        return OPENAI_RULES
    return ""
