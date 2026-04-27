import asyncio
import hashlib
import json
import os
import concurrent.futures
from typing import Dict, Any, Optional
from .intent_classifier import Intent, IntentResult
from ..adapters.dispatcher import AdapterDispatcher
from ..adapters.base import AdapterConfig

# Global cache for LLM intent results to prevent redundant calls
LLM_CACHE: Dict[str, IntentResult] = {}

class LLMIntentClassifier:
    """
    LLM-based intent classifier using Gemma/Gemini.
    Includes an in-memory caching layer and a safe sync wrapper for async adapter calls.
    """
    
    def __init__(self):
        # Initialize dispatcher; it automatically reads API keys from environment variables
        self.dispatcher = AdapterDispatcher()
        # Use a fast, cost-effective model for classification tasks
        self.model_name = os.getenv("INTENT_LLM_MODEL", "gemini-2.5-flash")
        self.timeout_sec = float(os.getenv("INTENT_CLASSIFIER_LLM_TIMEOUT_SEC", "12.0"))

    def _get_cache_key(self, prompt: str) -> str:
        """Returns a stable SHA-256 hash of the trimmed prompt."""
        return hashlib.sha256(prompt.strip().encode()).hexdigest()

    def classify(self, user_prompt: str) -> IntentResult:
        """
        Classify intent using LLM with caching and robust error handling.
        Returns a structured IntentResult.
        """
        # 1. Check Cache
        cache_key = self._get_cache_key(user_prompt)
        if cache_key in LLM_CACHE:
            return LLM_CACHE[cache_key]

        # 2. Call LLM with safe sync wrapper
        result: IntentResult
        try:
            result = self._call_llm_sync(user_prompt)
        except Exception as e:
            # SAFETY REQUIREMENT: Never crash the pipeline
            result = {
                "intent": "general",
                "confidence": 0.5,
                "source": "llm_error_fallback"
            }
        
        # 3. Store in cache and return
        LLM_CACHE[cache_key] = result
        return result

    def _call_llm_sync(self, user_prompt: str) -> IntentResult:
        """
        Production-ready sync wrapper for the async GeminiAdapter.
        Prevents nested event loop issues in Flask/Threading environments.
        """
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        
        async def _async_classify():
            # Use 'gemma' alias or 'gemini' (AdapterDispatcher handles both)
            adapter = self.dispatcher.get("gemini")
            config = AdapterConfig(
                model=self.model_name,
                temperature=0.1,  # Low temperature for deterministic classification
                max_tokens=64
            )
            
            prompt_template = f"""Classify the intent of the following user request.

Return ONLY JSON:
{{
"intent": one of [coding, debugging, explanation, refactor, general],
"confidence": a float between 0 and 1
}}

User request:
{user_prompt}"""
            
            response = await asyncio.wait_for(
                adapter.generate(
                    messages=[{"role": "user", "content": prompt_template}],
                    tools=None,
                    config=config
                ),
                timeout=self.timeout_sec,
            )
            
            # Extract and parse JSON
            try:
                # Remove markdown formatting if present
                clean_text = response.text.replace("```json", "").replace("```", "").strip()
                data = json.loads(clean_text)
                intent_value = str(data.get("intent", "general")).strip().lower()
                valid_intents = {
                    Intent.CODING.value,
                    Intent.DEBUGGING.value,
                    Intent.EXPLANATION.value,
                    Intent.REFACTOR.value,
                    Intent.GENERAL.value,
                }
                if intent_value not in valid_intents:
                    intent_value = Intent.GENERAL.value
                return {
                    "intent": intent_value,
                    "confidence": float(data.get("confidence", 0.85)),
                    "source": "llm"
                }
            except Exception:
                return {
                    "intent": "general",
                    "confidence": 0.5,
                    "source": "llm_parse_error"
                }

        # Safe execution logic
        if loop.is_running():
            with concurrent.futures.ThreadPoolExecutor() as pool:
                return pool.submit(lambda: asyncio.run(_async_classify())).result(timeout=self.timeout_sec + 1.0)
        else:
            return loop.run_until_complete(_async_classify())
