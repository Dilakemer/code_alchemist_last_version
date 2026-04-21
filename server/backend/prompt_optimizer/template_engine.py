from typing import Dict
from .intent_classifier import Intent
from . import templates

class TemplateEngine:
    """
    Manages prompt templates and renders them based on detected intent.
    """
    
    def __init__(self):
        # Mapping intents to their respective templates
        self._template_map: Dict[Intent, str] = {
            Intent.CODING: templates.CODING_TEMPLATE,
            Intent.DEBUGGING: templates.DEBUGGING_TEMPLATE,
            Intent.EXPLANATION: templates.EXPLANATION_TEMPLATE,
            Intent.REFACTOR: templates.REFACTOR_TEMPLATE,
            Intent.GENERAL: templates.GENERAL_TEMPLATE
        }

    def render(self, intent: Intent, user_prompt: str) -> str:
        """
        Selects the appropriate template and injects the user prompt.
        
        Args:
            intent: The detected intent of the user.
            user_prompt: The raw prompt from the user.
            
        Returns:
            The rendered (optimized) prompt.
        """
        template = self._template_map.get(intent, templates.GENERAL_TEMPLATE)
        return template.format(user_prompt=user_prompt)
