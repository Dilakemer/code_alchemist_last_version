import uuid
import time
import json
import logging
from typing import Dict, Any, Optional, List
from .intent_classifier import Intent
from .telemetry import logger

class RoutingDecision:
    """Deterministic routing data for the Optimizer Executor."""
    def __init__(self, intent: Intent, version: str, source: str, confidence: float):
        self.intent = intent
        self.version = version
        self.source = source
        self.confidence = confidence

class PromptOptimizationOrchestrator:
    """
    Production-grade 3-layer Orchestrator:
    1. Lightweight (Deterministic Routing)
    2. Online (Real-time Heuristics)
    3. Offline (Heavy LLM Analysis - Advisory)
    """

    def __init__(self, optimizer_version: str = "2.0"):
        self.optimizer_version = optimizer_version
        self.trace_id = str(uuid.uuid4())

    # --- Layer 1: Lightweight Orchestrator (Deterministic) ---
    def route_request(self, user_prompt: str) -> RoutingDecision:
        """
        Deterministic routing based on keywords/regex.
        Ensures control plane predictability.
        """
        # Note: In a full implementation, this uses a refined version of 
        # RuleBasedIntentClassifier. For now, we enforce deterministic rules.
        from .intent_classifier import HybridIntentClassifier
        classifier = HybridIntentClassifier()
        res = classifier.classify(user_prompt)
        
        # Determine strict version based on intent
        # (Version mapping is deterministic)
        version_map = {
            Intent.CODING: "coding_v2.1",
            Intent.DEBUGGING: "debug_v1.5",
            Intent.EXPLANATION: "expl_v1.0",
            Intent.REFACTOR: "refactor_v2.0",
            Intent.GENERAL: "gen_v1.0"
        }
        
        intent_enum = Intent(res["intent"])
        version = version_map.get(intent_enum, "gen_v1.0")
        
        return RoutingDecision(
            intent=intent_enum,
            version=version,
            source=res["source"],
            confidence=res["confidence"]
        )

    # --- Layer 2: Online Evaluator (Real-time Heuristics) ---
    def evaluate_online(self, 
                        original_prompt: str, 
                        model_response: str, 
                        latency_ms: int,
                        routing: RoutingDecision) -> Dict[str, Any]:
        """
        Fast heuristic-based evaluation post-execution.
        """
        success_score = 1.0
        issues = []

        # Heuristic 1: Response Length
        if len(model_response) < 10:
            success_score -= 0.5
            issues.append("suspiciously_short_response")

        # Heuristic 2: Latency Check
        if latency_ms > 8000:
            success_score -= 0.2
            issues.append("high_latency_warning")

        status = "success" if success_score > 0.7 else "partial_success"
        if success_score <= 0.4:
            status = "failure"

        return {
            "trace_id": self.trace_id,
            "status": status,
            "score": round(success_score, 2),
            "issues": issues,
            "metrics": {
                "latency_ms": latency_ms,
                "response_length": len(model_response)
            }
        }

    # --- Layer 3: Offline Orchestrator (Heavy Advisory Logic) ---
    def generate_learning_signal(self, 
                                 prompt: str, 
                                 response: str, 
                                 metrics: Dict[str, Any],
                                 routing: RoutingDecision) -> Dict[str, Any]:
        """
        Constructs the strict JSON signal for offline LLM-based batch analysis.
        This follows the PROMPTOPTIMIZATIONORCHESTRATOR input format.
        """
        return {
            "trace_id": self.trace_id,
            "prompt": prompt,
            "intent": routing.intent.value,
            "optimizer_version": self.optimizer_version,
            "model_response": response,
            "metrics": {
                "intent_correct": True, # Placeholder till heavy analysis
                "confidence": routing.confidence,
                "latency_ms": metrics.get("latency_ms", 0),
                "cost": 0.0, # To be filled by token usage logic
                "fallback_used": routing.source != "rule_based"
            }
        }

def get_orchestrator(version: str = "2.0") -> PromptOptimizationOrchestrator:
    return PromptOptimizationOrchestrator(version)
