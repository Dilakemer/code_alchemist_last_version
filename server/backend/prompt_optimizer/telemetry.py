import json
import logging
import hashlib
from datetime import datetime, timezone
from typing import Dict, Any, Optional

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger("prompt_optimizer.telemetry")

def log_prompt_optimization(
    prompt: str, 
    intent: str, 
    optimizer_version: str, 
    trace_id: Optional[str] = None,
    prompt_version: Optional[str] = None,
    metrics: Optional[Dict[str, Any]] = None
) -> None:
    """Logs structured telemetry for a prompt optimization event with full correlation."""
    try:
        prompt_hash = hashlib.sha256(prompt.encode()).hexdigest()[:12]
        logged_prompt = prompt if len(prompt) <= 200 else prompt[:200] + "..."
        
        log_event: Dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "event": "prompt_optimized",
            "trace_id": trace_id,
            "intent": intent,
            "prompt_version": prompt_version,
            "optimizer_version": optimizer_version,
            "prompt_hash": prompt_hash,
            "original_prompt": logged_prompt,
            "metrics": metrics or {}
        }
        logger.info(json.dumps(log_event))
    except Exception as e:
        logger.warning(f"Telemetry failed: {e}")

def log_orchestrator_signal(signal: Dict[str, Any]) -> None:
    """Logs the strict JSON learning signal from the Orchestrator."""
    try:
        log_event = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "event": "orchestrator_signal",
            "payload": signal
        }
        logger.info(json.dumps(log_event))
    except Exception:
        pass

def log_optimizer_fallback(reason: str, prompt: str, trace_id: Optional[str] = None) -> None:
    """Logs when the optimizer fails and falls back to original prompt."""
    try:
        log_event = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "event": "optimizer_fallback",
            "trace_id": trace_id,
            "reason": reason,
            "prompt_preview": (prompt or "")[:100]
        }
        logger.info(json.dumps(log_event))
    except Exception:
        pass
