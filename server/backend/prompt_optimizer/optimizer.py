from typing import Dict, Any, Optional
from .intent_classifier import Intent
from .template_engine import TemplateEngine
from .telemetry import log_prompt_optimization

# Optimizer constants
OPTIMIZER_VERSION = "2.0"

class PromptOptimizer:
    """
    Executor for the Prompt Optimizer pipeline.
    Applies templates based on deterministic routing decisions.
    """
    
    def __init__(self):
        self.engine = TemplateEngine()

    def execute(self, user_prompt: str, routing: Any) -> Dict[str, Any]:
        """
        Executes the optimization by applying the selected version template.
        
        Args:
            user_prompt: The raw user input.
            routing: A RoutingDecision object from the Orchestrator.
        """
        # 1. Validation
        if not isinstance(user_prompt, str) or not user_prompt.strip():
            raise ValueError("user_prompt must be a non-empty string")
            
        # 2. Render template based on routing decision
        optimized_prompt = self.engine.render(routing.intent, user_prompt)
        
        # 3. Return structured result
        return {
            "intent": routing.intent.value,
            "confidence": routing.confidence,
            "source": routing.source,
            "optimized_prompt": optimized_prompt,
            "prompt_version": routing.version,
            "optimizer_version": OPTIMIZER_VERSION
        }

# Legacy wrapper for backward compatibility - now uses orchestrator discovery
def optimize_prompt(user_prompt: str) -> Dict[str, Any]:
    from .orchestrator import get_orchestrator
    orch = get_orchestrator()
    routing = orch.route_request(user_prompt)
    optimizer = PromptOptimizer()
    return optimizer.execute(user_prompt, routing)
