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

    def render(self, intent: Intent, user_prompt: str, model_name: str = "") -> str:
        """
        Selects the appropriate template and injects the user prompt.
        Also appends model-specific optimization rules if available.
        """
        from .model_rules import get_rules_for_model
        
        template = self._template_map.get(intent, templates.GENERAL_TEMPLATE)
        base_prompt = template.format(user_prompt=user_prompt)
        
        model_rules = get_rules_for_model(model_name)
        if model_rules:
            return f"{base_prompt}\n\n{model_rules}"
            
        return base_prompt
