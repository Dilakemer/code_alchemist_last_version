import os
from enum import Enum
from typing import Protocol, List, Dict, Pattern, TypedDict, Any, Optional, Tuple
import re

class Intent(str, Enum):
    """Supported intents for the Prompt Optimizer."""
    CODING = "coding"
    DEBUGGING = "debugging"
    EXPLANATION = "explanation"
    REFACTOR = "refactor"
    GENERAL = "general"

class IntentResult(TypedDict):
    """Standard return structure for intent classification."""
    intent: str
    confidence: float
    source: str

class BaseIntentClassifier(Protocol):
    """Protocol for intent classification to allow for future LLM implementations."""
    def classify(self, user_prompt: str) -> IntentResult:
        ...


def _normalize_intent_value(value: Any) -> Intent:
    if isinstance(value, Intent):
        return value

    candidate = str(value or '').strip().lower()
    alias_map = {
        'coding': Intent.CODING,
        'code': Intent.CODING,
        'debugging': Intent.DEBUGGING,
        'debug': Intent.DEBUGGING,
        'explanation': Intent.EXPLANATION,
        'explain': Intent.EXPLANATION,
        'refactor': Intent.REFACTOR,
        'general': Intent.GENERAL,
    }
    return alias_map.get(candidate, Intent.GENERAL)


def _normalize_confidence(value: Any, default: float = 0.5) -> float:
    try:
        confidence = float(value)
    except (TypeError, ValueError):
        confidence = default
    return max(0.0, min(0.99, confidence))

class RuleBasedIntentClassifier:
    """
    Keyword-based intent classifier with regex word boundaries.
    Supports English and Turkish keywords with pre-compiled patterns for performance.
    """
    
    # Keyword mappings for various intents in priority order
    _INTENT_KEYWORDS: Dict[Intent, List[str]] = {
        Intent.REFACTOR: [
            "refactor", "improve", "optimize", "cleanup",
            "iyileştir", "optimize et", "daha iyi yap"
        ],
        Intent.DEBUGGING: [
            "fix", "bug", "error", "debug", "issue",
            "düzelt", "hata", "çalışmıyor", "bozuk"
        ],
        Intent.EXPLANATION: [
            "explain", "what is", "how does", "documentation",
            "açıkla", "nedir", "nasıl çalışır"
        ],
        Intent.CODING: [
            "write", "create", "generate", "build", "function", "class",
            "yaz", "oluştur", "fonksiyon yaz",
            "dosya", "dosyama", "dosyada", "el at", "bakar mısın"
        ]
    }

    # Keyword weights for scoring
    STRONG_WEIGHT = 0.6
    WEAK_WEIGHT = 0.3

    def __init__(self):
        # Pre-compile regex patterns for better production performance
        self._compiled_patterns: Dict[Intent, List[Pattern]] = {}
        
        # Use a fixed normalization factor of 1.2 (roughly 2 strong or 4 weak keywords)
        # to ensure realistic confidence scores for typical user prompts.
        self._max_possible_score = 1.2

        for intent, keywords in self._INTENT_KEYWORDS.items():
            patterns = [
                re.compile(rf"\b{re.escape(kw)}\b", re.IGNORECASE)
                for kw in keywords
            ]
            self._compiled_patterns[intent] = patterns

    def _score_prompt(self, user_prompt: str) -> Dict[Intent, float]:
        prompt_lower = (user_prompt or '').lower()
        scores: Dict[Intent, float] = {intent: 0.0 for intent in self._compiled_patterns}

        for intent, patterns in self._compiled_patterns.items():
            score = 0.0
            for index, pattern in enumerate(patterns):
                if pattern.search(prompt_lower):
                    score += self.STRONG_WEIGHT if index < 2 else self.WEAK_WEIGHT
            scores[intent] = score

        return scores

    def _rank_scores(self, scores: Dict[Intent, float]) -> List[Tuple[Intent, float]]:
        return sorted(scores.items(), key=lambda item: item[1], reverse=True)

    def classify(self, user_prompt: str) -> IntentResult:
        """
        Classify the intent of the user prompt based on keyword matches.
        Uses regex word boundaries to avoid false positives.
        Confidence is normalized based on keyword weights.
        """
        scores = self._score_prompt(user_prompt)
        ranked = self._rank_scores(scores)
        best_intent, best_score = ranked[0]
        if best_score <= 0:
            return {
                "intent": Intent.GENERAL.value,
                "confidence": 0.0,
                "source": "rule_based"
            }
        max_confidence = min(0.99, best_score / self._max_possible_score)
        
        return {
            "intent": best_intent.value,
            "confidence": round(max_confidence, 2),
            "source": "rule_based"
        }


class HybridIntentClassifier:
    """
    Hybrid intent classifier that uses regex first and LLM fallback when confidence is low or ambiguous.
    """

    def __init__(
        self,
        rule_classifier: Optional[RuleBasedIntentClassifier] = None,
        llm_classifier: Optional[Any] = None,
        llm_enabled: Optional[bool] = None,
        rule_confidence_threshold: Optional[float] = None,
        confidence_gap_threshold: Optional[float] = None,
        llm_min_confidence: Optional[float] = None,
    ):
        self.rule_classifier = rule_classifier or RuleBasedIntentClassifier()
        self._llm_classifier = llm_classifier
        self.llm_enabled = self._read_bool_env('INTENT_CLASSIFIER_LLM_ENABLED', default=True) if llm_enabled is None else llm_enabled
        self.rule_confidence_threshold = self._read_float_env('INTENT_CLASSIFIER_RULE_CONFIDENCE_THRESHOLD', default=0.72) if rule_confidence_threshold is None else rule_confidence_threshold
        self.confidence_gap_threshold = self._read_float_env('INTENT_CLASSIFIER_CONFIDENCE_GAP_THRESHOLD', default=0.15) if confidence_gap_threshold is None else confidence_gap_threshold
        self.llm_min_confidence = self._read_float_env('INTENT_CLASSIFIER_LLM_MIN_CONFIDENCE', default=0.55) if llm_min_confidence is None else llm_min_confidence

    @staticmethod
    def _read_bool_env(name: str, default: bool = True) -> bool:
        raw = os.getenv(name)
        if raw is None:
            return default
        return raw.strip().lower() not in {'0', 'false', 'no', 'off'}

    @staticmethod
    def _read_float_env(name: str, default: float) -> float:
        raw = os.getenv(name)
        if raw is None:
            return default
        try:
            return float(raw)
        except ValueError:
            return default

    def _get_llm_classifier(self) -> Optional[Any]:
        if self._llm_classifier is not None:
            return self._llm_classifier

        if not self.llm_enabled:
            return None

        try:
            from .llm_intent_classifier import LLMIntentClassifier
            self._llm_classifier = LLMIntentClassifier()
            return self._llm_classifier
        except Exception:
            return None

    def _should_use_llm(self, user_prompt: str, rule_confidence: float, confidence_gap: float) -> bool:
        if not self.llm_enabled:
            return False

        prompt = (user_prompt or '').strip().lower()

        if len(prompt) < 8:
            return False

        # Short-circuit for file-edit phrasing to avoid expensive/slow fallback calls.
        has_file_hint = bool(re.search(r"\.(py|js|jsx|ts|tsx|java|go|rs|cpp|c|html|css|md)\b", prompt))
        has_edit_hint = bool(re.search(r"(dosya|dosyama|file|edit|duzelt|düzelt|guncelle|güncelle|el at|bakar mısın|touch|update|fix)", prompt))
        if has_file_hint and has_edit_hint:
            return False

        if rule_confidence >= self.rule_confidence_threshold and confidence_gap >= self.confidence_gap_threshold:
            return False

        return True

    def classify(self, user_prompt: str) -> IntentResult:
        rule_result = self.rule_classifier.classify(user_prompt)
        rule_intent = _normalize_intent_value(rule_result.get('intent'))
        rule_confidence = _normalize_confidence(rule_result.get('confidence'), default=0.0)

        scores = self.rule_classifier._score_prompt(user_prompt)
        ranked = self.rule_classifier._rank_scores(scores)
        top_score = ranked[0][1] if ranked else 0.0
        runner_up_score = ranked[1][1] if len(ranked) > 1 else 0.0
        confidence_gap = top_score - runner_up_score

        normalized_rule_result: IntentResult = {
            'intent': rule_intent.value,
            'confidence': round(rule_confidence, 2),
            'source': 'hybrid_rule',
        }

        if not self._should_use_llm(user_prompt, rule_confidence, confidence_gap):
            return normalized_rule_result

        llm_classifier = self._get_llm_classifier()
        if llm_classifier is None:
            return {
                **normalized_rule_result,
                'source': 'hybrid_rule_fallback',
            }

        try:
            llm_result = llm_classifier.classify(user_prompt)
        except Exception:
            return {
                **normalized_rule_result,
                'source': 'hybrid_rule_fallback',
            }

        llm_intent = _normalize_intent_value(llm_result.get('intent'))
        llm_confidence = _normalize_confidence(llm_result.get('confidence'), default=0.5)
        llm_source = str(llm_result.get('source') or 'llm')

        if llm_intent == Intent.GENERAL and rule_intent != Intent.GENERAL:
            return normalized_rule_result

        if llm_confidence < self.llm_min_confidence and rule_confidence >= llm_confidence:
            return normalized_rule_result

        if llm_intent != rule_intent and (llm_confidence + 0.05) < rule_confidence:
            return normalized_rule_result

        return {
            'intent': llm_intent.value,
            'confidence': round(max(llm_confidence, rule_confidence), 2),
            'source': f'hybrid_{llm_source}',
        }
