import hashlib
import heapq
import os
import re
import time
from datetime import datetime
from typing import Any, Iterable
import concurrent.futures

try:
    from google import genai as google_genai
except Exception:
    google_genai = None

MEMORY_ITEM_LIMIT = 3
MEMORY_CHAR_BUDGET = 1000
EMBEDDING_CANDIDATE_LIMIT = 12
EMBEDDING_CACHE_TTL = 1800
SEMANTIC_WEIGHT = 0.6
LEXICAL_WEIGHT = 0.3
RECENCY_WEIGHT = 0.1
IMPORTANCE_WEIGHT = 0.1
TASK_ALIGNMENT_WEIGHT = 0.15
DEFAULT_CAPSULE_MIN_CONFIDENCE = 0.42
DEFAULT_CAPSULE_MAX_LINES = 5
GRAPH_COMPACTION_NODE_LIMIT = 24
GRAPH_COMPACTION_EDGE_LIMIT = 48
GRAPH_AUDIT_DETAIL_LIMIT = 12
REPLAY_TRACE_NODE_LIMIT = 10
RELATION_ONTOLOGY = {'supports', 'refines', 'invalidates', 'replaces', 'derives_from'}
RELATION_TYPE_ALIASES = {
    'depends_on': 'derives_from',
    'conflicts_with': 'invalidates',
    'reinforces': 'supports',
    'supersedes': 'replaces',
    'derivative_of': 'derives_from',
}

_EMBEDDING_CLIENT = None
_EMBEDDING_CACHE: dict[str, dict[str, Any]] = {}

TOPIC_RULES = [
    {
        'module_key': 'project_scope',
        'memory_type': 'context',
        'importance': 5,
        'label': 'Project scope',
        'keywords': ('site', 'website', 'landing page', 'web app', 'frontend', 'ui', 'ux', 'tasarim', 'tasarım', 'sayfa'),
        'pattern': re.compile(
            r'\b(?:site|website|landing page|web app|frontend|ui|ux|tasarim|tasarım|sayfa)\b(?:\s*(?:projesi|icin|için|olarak|design|tasarimi|tasarımı)?\s*)[:=\-]?\s*([^\n.,;!?]{2,180})',
            re.IGNORECASE,
        ),
    },
    {
        'module_key': 'ui_style',
        'memory_type': 'preference',
        'importance': 4,
        'label': 'UI style preference',
        'keywords': ('minimal', 'modern', 'dark mode', 'light mode', 'renk', 'palette', 'font', 'layout', 'responsive'),
        'pattern': re.compile(
            r'\b(?:minimal|modern|dark mode|light mode|renk|palette|font|layout|responsive)\b(?:\s*(?:style|tarz|tasarim|tasarım|tercihi|olarak)?\s*)[:=\-]?\s*([^\n.,;!?]{2,160})',
            re.IGNORECASE,
        ),
    },
    {
        'module_key': 'tech_stack',
        'memory_type': 'constraint',
        'importance': 4,
        'label': 'Tech stack choice',
        'keywords': ('react', 'vue', 'next.js', 'nextjs', 'tailwind', 'flask', 'node', 'typescript', 'javascript', 'css'),
        'pattern': re.compile(
            r'\b(?:react|vue|next\.js|nextjs|tailwind|flask|node|typescript|javascript|css)\b(?:\s*(?:ile|using|kullanarak|stack|tech)?\s*)[:=\-]?\s*([^\n.,;!?]{2,180})',
            re.IGNORECASE,
        ),
    },
    {
        'module_key': 'category',
        'memory_type': 'preference',
        'importance': 5,
        'label': 'Category decision',
        'keywords': ('kategori', 'category', 'product category', 'urun kategorisi'),
        'pattern': re.compile(
            r'\b(?:kategori|category|product category|urun kategorisi)\b(?:\s*(?:tercihi|secimi|choice|pref|olarak)?\s*)[:=\-]?\s*([^\n.,;!?]{2,120})',
            re.IGNORECASE,
        ),
    },
    {
        'module_key': 'payment',
        'memory_type': 'preference',
        'importance': 5,
        'label': 'Payment preference',
        'keywords': ('odeme', 'payment', 'kart', 'credit card', 'paypal', 'stripe', 'havale', 'nakit', 'kapida odeme'),
        'pattern': re.compile(
            r'\b(?:odeme|payment|payment method|kapida odeme|kredi karti|credit card|paypal|stripe|havale|nakit)\b(?:\s*(?:tercihi|secimi|method|olarak)?\s*)[:=\-]?\s*([^\n.,;!?]{2,120})',
            re.IGNORECASE,
        ),
    },
    {
        'module_key': 'delivery',
        'memory_type': 'preference',
        'importance': 4,
        'label': 'Delivery preference',
        'keywords': ('teslimat', 'delivery', 'shipping', 'kargo', 'kurye', 'express', 'aynı gun', 'ayni gun'),
        'pattern': re.compile(
            r'\b(?:teslimat|delivery|shipping|kargo|kurye|express|ayni gun|aynı gun)\b(?:\s*(?:tercihi|secimi|olarak)?\s*)[:=\-]?\s*([^\n.,;!?]{2,120})',
            re.IGNORECASE,
        ),
    },
    {
        'module_key': 'constraint',
        'memory_type': 'constraint',
        'importance': 5,
        'label': 'Constraint',
        'keywords': ('kisit', 'constraint', 'budget', 'butce', 'deadline', 'minimum', 'maximum', 'sadece', 'olmasin'),
        'pattern': re.compile(
            r'\b(?:kisit|constraint|budget|butce|deadline|minimum|maximum|sadece|olmasin)\b(?:\s*(?:kurali|geregi|olarak)?\s*)[:=\-]?\s*([^\n.,;!?]{2,140})',
            re.IGNORECASE,
        ),
    },
    {
        'module_key': 'preference',
        'memory_type': 'preference',
        'importance': 3,
        'label': 'Preference',
        'keywords': ('tercih', 'prefer', 'severim', 'istiyorum', 'istemiyorum', 'seviyorum', 'avoid', 'default'),
        'pattern': re.compile(
            r'\b(?:tercih|prefer|severim|istiyorum|istemiyorum|seviyorum|avoid|default)\b(?:\s*(?:olarak|etmek|ediyorum)?\s*)[:=\-]?\s*([^\n.,;!?]{2,120})',
            re.IGNORECASE,
        ),
    },
]


def _normalize_text(text: str) -> str:
    return re.sub(r'\s+', ' ', (text or '').strip())


def _truncate_text(text: str, limit: int) -> str:
    normalized = _normalize_text(text)
    if len(normalized) <= limit:
        return normalized
    if limit <= 1:
        return normalized[:limit]
    return normalized[: limit - 1].rstrip() + '…'


def _split_sentences(text: str) -> list[str]:
    parts = re.split(r'[\n.!?;]+', text or '')
    return [_normalize_text(part) for part in parts if _normalize_text(part)]


def _candidate_value(item: Any, key: str, default: Any = None) -> Any:
    if isinstance(item, dict):
        return item.get(key, default)
    return getattr(item, key, default)


def _candidate_datetime(item: Any) -> datetime:
    for key in ('updated_at', 'last_used_at', 'created_at'):
        value = _candidate_value(item, key)
        if value is not None:
            return value
    return datetime.min


def _embedding_model_candidates() -> list[str]:
    configured = os.getenv('EMBEDDING_MODEL_NAME', 'models/text-embedding-004')
    candidates = [
        configured,
        'models/text-embedding-004',
        'text-embedding-004',
        'models/text-embedding-005',
        'text-embedding-005',
        'models/gemini-embedding-2-preview',
        'gemini-embedding-2-preview',
    ]

    unique_candidates = []
    seen = set()
    for model_name in candidates:
        if model_name and model_name not in seen:
            seen.add(model_name)
            unique_candidates.append(model_name)
    return unique_candidates


def _get_embedding_client():
    global _EMBEDDING_CLIENT

    if _EMBEDDING_CLIENT is not None:
        return _EMBEDDING_CLIENT

    api_key = os.getenv('GEMINI_API_KEY')
    if not api_key or google_genai is None:
        return None

    try:
        _EMBEDDING_CLIENT = google_genai.Client(api_key=api_key)
    except Exception:
        _EMBEDDING_CLIENT = None

    return _EMBEDDING_CLIENT


def _embedding_cache_key(text: str, task_type: str) -> str:
    normalized = _normalize_text(text).lower()
    digest = hashlib.sha1(normalized.encode('utf-8')).hexdigest()
    return f'{task_type}:{digest}'


def _get_cached_embedding(text: str, task_type: str) -> tuple[list[float] | None, str | None]:
    cache_key = _embedding_cache_key(text, task_type)
    cached = _EMBEDDING_CACHE.get(cache_key)
    if not cached:
        return None, None

    if time.time() - cached.get('timestamp', 0) > EMBEDDING_CACHE_TTL:
        _EMBEDDING_CACHE.pop(cache_key, None)
        return None, None

    return cached.get('embedding'), cached.get('model_name')


def _store_embedding_cache(text: str, task_type: str, embedding: list[float], model_name: str | None) -> None:
    cache_key = _embedding_cache_key(text, task_type)
    _EMBEDDING_CACHE[cache_key] = {
        'timestamp': time.time(),
        'embedding': embedding,
        'model_name': model_name,
    }


def _extract_embedding_values(resp):
    try:
        if isinstance(resp, dict):
            if isinstance(resp.get('embedding'), list):
                return resp.get('embedding')
            emb_list = resp.get('embeddings')
            if isinstance(emb_list, list) and emb_list:
                first = emb_list[0]
                if isinstance(first, dict):
                    if isinstance(first.get('values'), list):
                        return first.get('values')
                    if isinstance(first.get('embedding'), list):
                        return first.get('embedding')

        if hasattr(resp, 'embedding') and isinstance(resp.embedding, list):
            return resp.embedding

        if hasattr(resp, 'embeddings') and resp.embeddings:
            first = resp.embeddings[0]
            if hasattr(first, 'values') and isinstance(first.values, list):
                return first.values
            if hasattr(first, 'embedding') and isinstance(first.embedding, list):
                return first.embedding
    except Exception:
        return None

    return None


def _embed_text_with_fallback(text, task_type='RETRIEVAL_DOCUMENT'):
    if not text:
        return None, None

    cached_embedding, cached_model = _get_cached_embedding(text, task_type)
    if cached_embedding:
        return cached_embedding, cached_model

    client = _get_embedding_client()
    if not client:
        return None, None

    for model_name in _embedding_model_candidates():
        try:
            response = client.models.embed_content(
                model=model_name,
                contents=text,
                config={'task_type': task_type},
            )
            values = _extract_embedding_values(response)
            if values:
                _store_embedding_cache(text, task_type, values, model_name)
                return values, model_name
        except Exception:
            continue

    return None, None


def _recency_score(item: Any) -> float:
    item_datetime = _candidate_datetime(item)
    if item_datetime == datetime.min:
        return 0.25

    age_seconds = max((datetime.utcnow() - item_datetime).total_seconds(), 0.0)
    age_days = age_seconds / 86400.0
    return 1.0 / (1.0 + age_days)


def _normalize_score(value: float, ceiling: float = 10.0) -> float:
    if ceiling <= 0:
        return 0.0
    return max(0.0, min(1.0, value / ceiling))


def _cosine_similarity(v1, v2):
    if not v1 or not v2 or len(v1) != len(v2):
        return -1.0

    dot = 0.0
    norm_1 = 0.0
    norm_2 = 0.0
    for a, b in zip(v1, v2):
        dot += a * b
        norm_1 += a * a
        norm_2 += b * b

    if norm_1 <= 0.0 or norm_2 <= 0.0:
        return -1.0

    return dot / ((norm_1 ** 0.5) * (norm_2 ** 0.5))


def _candidate_rule_for_module(module_key: str) -> dict[str, Any]:
    return next((rule for rule in TOPIC_RULES if rule['module_key'] == module_key), {'keywords': ()})


def _lexical_score(question: str, content: str, module_key: str, importance: int) -> float:
    score = float(importance) + float(_score_query_overlap(content, question))
    lowered_question = (question or '').lower()

    if module_key and module_key.lower() in lowered_question:
        score += 3.0
    elif _rule_matches(question, _candidate_rule_for_module(module_key)):
        score += 2.0

    return score


def _combined_score(semantic_score: float | None, lexical_score: float, recency_score: float) -> float:
    lexical_component = _normalize_score(lexical_score)
    recency_component = max(0.0, min(1.0, recency_score))

    if semantic_score is None:
        return (lexical_component * 0.8) + (recency_component * 0.2)

    semantic_component = max(0.0, min(1.0, semantic_score))
    return (
        semantic_component * SEMANTIC_WEIGHT
        + lexical_component * LEXICAL_WEIGHT
        + recency_component * RECENCY_WEIGHT
    )


def _importance_score(importance: int) -> float:
    return max(0.0, min(1.0, float(max(importance, 0)) / 5.0))


def _task_context_alignment(question: str, module_key: str, content: str) -> float:
    q = (question or '').lower()
    c = (content or '').lower()
    mk = (module_key or '').lower()

    align_patterns = {
        'project_scope': ('project', 'website', 'scope', 'mvp', 'product'),
        'tech_stack': ('stack', 'framework', 'backend', 'frontend', 'library', 'react', 'flask', 'tailwind'),
        'ui_style': ('ui', 'ux', 'design', 'style', 'layout', 'responsive', 'theme'),
        'constraint': ('constraint', 'budget', 'deadline', 'limit', 'cost', 'performance'),
        'payment': ('payment', 'checkout', 'stripe', 'wallet', 'billing'),
        'delivery': ('delivery', 'shipping', 'cargo', 'logistics'),
        'category': ('category', 'taxonomy', 'segment'),
        'preference': ('prefer', 'preference', 'default', 'choice'),
    }

    terms = align_patterns.get(mk, ())
    if not terms:
        return 0.0

    q_hits = sum(1 for term in terms if term in q)
    c_hits = sum(1 for term in terms if term in c)
    if q_hits == 0:
        return 0.0

    return min(1.0, ((q_hits * 0.7) + (c_hits * 0.3)) / max(len(terms) * 0.4, 1.0))


def _memory_reasoning_score(candidate: dict[str, Any]) -> float:
    semantic_component = candidate.get('semantic_score')
    lexical_component = _normalize_score(float(candidate.get('lexical_score') or 0.0))
    recency_component = max(0.0, min(1.0, float(candidate.get('recency_score') or 0.0)))
    importance_component = _importance_score(int(candidate.get('importance') or 1))
    alignment_component = max(0.0, min(1.0, float(candidate.get('task_alignment') or 0.0)))

    if semantic_component is None:
        semantic_component = min(1.0, lexical_component * 0.9)

    semantic_component = max(0.0, min(1.0, float(semantic_component)))

    # This score is intentionally semantic-dominant for top-k retrieval.
    return (
        semantic_component * 0.55
        + lexical_component * 0.10
        + recency_component * 0.10
        + importance_component * IMPORTANCE_WEIGHT
        + alignment_component * TASK_ALIGNMENT_WEIGHT
    )


def _select_diverse_candidates(candidates: list[dict[str, Any]], max_items: int) -> list[dict[str, Any]]:
    selected = []
    seen_keys = set()

    for candidate in candidates:
        key = (
            candidate.get('source_type'),
            candidate.get('source_id'),
            candidate.get('module_key'),
            candidate.get('content'),
        )
        if key in seen_keys:
            continue

        seen_keys.add(key)
        selected.append(candidate)
        if len(selected) >= max_items:
            break

    if len(selected) < max_items:
        for candidate in candidates:
            if candidate in selected:
                continue
            selected.append(candidate)
            if len(selected) >= max_items:
                break

    return selected


def _score_query_overlap(text: str, question: str) -> int:
    text_terms = set(re.findall(r'[a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF\u0100-\u017F]+', (text or '').lower()))
    question_terms = set(re.findall(r'[a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF\u0100-\u017F]+', (question or '').lower()))
    return len(text_terms.intersection(question_terms))


def _rule_matches(text: str, rule: dict[str, Any]) -> bool:
    lowered = (text or '').lower()
    return any(keyword in lowered for keyword in rule['keywords'])


def _extract_rule_content(sentence: str, rule: dict[str, Any]) -> str:
    match = rule['pattern'].search(sentence)
    if match and match.group(1):
        return _truncate_text(match.group(1), 180)
    return _truncate_text(sentence, 180)


def extract_memory_candidates(question: str, answer: str = '') -> list[dict[str, Any]]:
    source_text = '\n'.join(part for part in [question or '', answer or ''] if part).strip()
    if not source_text:
        return []

    sentences = _split_sentences(source_text)
    seen = set()
    candidates: list[dict[str, Any]] = []

    for rule in TOPIC_RULES:
        matched_sentence = None
        for sentence in sentences:
            if _rule_matches(sentence, rule):
                matched_sentence = sentence
                break

        if not matched_sentence:
            continue

        content = _extract_rule_content(matched_sentence, rule)
        dedupe_key = (rule['module_key'], content.lower())
        if dedupe_key in seen:
            continue

        seen.add(dedupe_key)
        candidates.append({
            'memory_type': rule['memory_type'],
            'module_key': rule['module_key'],
            'content': content,
            'importance': rule['importance'],
        })

    return candidates


def _render_memory_candidate(candidate: dict[str, Any]) -> str:
    source_type = candidate.get('source_type', 'memory')
    module_key = candidate.get('module_key') or 'general'
    content = _normalize_text(candidate.get('content') or candidate.get('summary_text') or '')

    if source_type == 'summary':
        label = 'Recent summary'
    else:
        label = 'Decision'

    prefix = f'{label} [{module_key}]'
    if candidate.get('memory_type') and source_type != 'summary':
        prefix = f'{prefix} ({candidate["memory_type"]})'

    if not content:
        content = 'No details available.'

    return f'{prefix}: {content}'


def build_memory_context(
    question: str,
    memory_items: Iterable[Any] | None = None,
    summaries: Iterable[Any] | None = None,
    char_budget: int = MEMORY_CHAR_BUDGET,
    max_items: int = MEMORY_ITEM_LIMIT,
) -> dict[str, Any]:
    question = question or ''
    memory_candidates = []
    summary_candidates = []

    for item in memory_items or []:
        content = _candidate_value(item, 'content', '')
        module_key = _candidate_value(item, 'module_key', 'general')
        importance = int(_candidate_value(item, 'importance', 1) or 1)
        lexical_score = _lexical_score(question, content, module_key, importance)

        memory_candidates.append({
            'source_type': 'memory',
            'source_id': _candidate_value(item, 'id'),
            'memory_type': _candidate_value(item, 'memory_type', 'preference'),
            'module_key': module_key,
            'content': content,
            'importance': importance,
            'lexical_score': lexical_score,
            'recency_score': _recency_score(item),
            'semantic_score': None,
            'task_alignment': _task_context_alignment(question, module_key, content),
            'score': lexical_score,
            'updated_at': _candidate_datetime(item),
            'candidate_text': content,
        })

    for item in summaries or []:
        summary_text = _candidate_value(item, 'summary_text', '')
        module_key = _candidate_value(item, 'module_key', 'summary')
        if not summary_text:
            continue

        lexical_score = float(_score_query_overlap(summary_text, question))
        summary_candidates.append({
            'source_type': 'summary',
            'source_id': _candidate_value(item, 'id'),
            'module_key': module_key,
            'content': summary_text,
            'summary_text': summary_text,
            'importance': int(_candidate_value(item, 'importance', 1) or 1),
            'lexical_score': lexical_score,
            'recency_score': _recency_score(item),
            'semantic_score': None,
            'task_alignment': _task_context_alignment(question, module_key, summary_text),
            'score': lexical_score,
            'updated_at': _candidate_datetime(item),
            'candidate_text': summary_text,
        })

    memory_candidates.sort(key=lambda item: (item['score'], item['importance'], item['updated_at']), reverse=True)
    summary_candidates.sort(key=lambda item: (item['score'], item['updated_at']), reverse=True)

    shortlisted = list(memory_candidates[:EMBEDDING_CANDIDATE_LIMIT])
    shortlisted.extend(summary_candidates)

    query_embedding, query_model = _embed_text_with_fallback(question, task_type='RETRIEVAL_QUERY')
    if query_embedding:
        def _embed_and_score(candidate):
            text = candidate.get('candidate_text', candidate.get('content', ''))
            candidate_embedding, candidate_model = _embed_text_with_fallback(
                text,
                task_type='RETRIEVAL_DOCUMENT',
            )
            if candidate_embedding:
                candidate['semantic_score'] = max(0.0, _cosine_similarity(query_embedding, candidate_embedding))
                candidate['embedding_model'] = candidate_model
            candidate['score'] = _memory_reasoning_score(candidate)
            return candidate

        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
            # Parallelize embedding calls for the shortlisted candidates
            list(executor.map(_embed_and_score, shortlisted))
    else:
        for candidate in shortlisted:
            candidate['score'] = _memory_reasoning_score(candidate)

    shortlisted.sort(key=lambda item: (item['score'], item['importance'], item['updated_at']), reverse=True)
    selected = _select_diverse_candidates(shortlisted, max_items)

    if not selected:
        return {
            'text': '',
            'hit_count': 0,
            'hits': [],
            'retrieval_mode': 'empty',
            'focus_module': None,
        }

    lines = ['[System Memory]']
    remaining_budget = max(char_budget - len(lines[0]) - 1, 0)
    rendered_hits = []

    for candidate in selected[:max_items]:
        rendered = _render_memory_candidate(candidate)
        if remaining_budget <= 0:
            break
        rendered = _truncate_text(rendered, min(remaining_budget, 320))
        if not rendered:
            continue

        rendered_hits.append({**candidate, 'rendered': rendered})
        lines.append(f'- {rendered}')
        remaining_budget -= len(rendered) + 2
        if remaining_budget <= 0:
            break

    text = '\n'.join(lines).strip()
    if len(text) > char_budget:
        text = text[: max(char_budget - 1, 0)].rstrip() + '…'

    return {
        'text': text,
        'hit_count': len(rendered_hits),
        'hits': rendered_hits,
        'retrieval_mode': 'hybrid-embedding' if query_embedding else 'lexical-fallback',
        'focus_module': rendered_hits[0].get('module_key') if rendered_hits else None,
        'query_embedding_model': query_model,
    }


def _capsule_label(module_key: str) -> str:
    labels = {
        'project_scope': 'Project',
        'tech_stack': 'Stack',
        'ui_style': 'Style',
        'constraint': 'Constraints',
        'summary': 'SessionSummary',
        'preference': 'Preference',
    }
    return labels.get(module_key or '', (module_key or 'Context').title())


def _render_capsule_line(hit: dict[str, Any]) -> str:
    label = _capsule_label(hit.get('module_key'))
    content = _normalize_text(hit.get('content') or hit.get('summary_text') or '')
    content = _truncate_text(content, 140)
    confidence = hit.get('score') or 0.0
    return f'- {label}: {content} (score={confidence:.2f})'


def build_minimum_continuation_capsule(
    question: str,
    memory_items: Iterable[Any] | None = None,
    summaries: Iterable[Any] | None = None,
    char_budget: int = 420,
    max_lines: int = DEFAULT_CAPSULE_MAX_LINES,
    min_confidence: float = DEFAULT_CAPSULE_MIN_CONFIDENCE,
) -> dict[str, Any]:
    base_context = build_memory_context(
        question,
        memory_items=memory_items,
        summaries=summaries,
        char_budget=max(char_budget, 320),
        max_items=max(max_lines, 3),
    )

    hits = base_context.get('hits', [])
    if not hits:
        return {
            'text': '',
            'hit_count': 0,
            'hits': [],
            'retrieval_mode': base_context.get('retrieval_mode', 'empty'),
            'focus_module': None,
            'avg_confidence': 0.0,
            'dropped_low_confidence': 0,
        }

    selected_hits = []
    seen_modules = set()
    dropped_low_confidence = 0

    for hit in hits:
        confidence = float(hit.get('score') or 0.0)
        if confidence < min_confidence:
            dropped_low_confidence += 1
            continue

        module_key = hit.get('module_key') or 'general'
        if module_key in seen_modules:
            continue

        seen_modules.add(module_key)
        selected_hits.append(hit)
        if len(selected_hits) >= max_lines:
            break

    # Ensure we always preserve at least one useful memory line.
    if not selected_hits and hits:
        selected_hits.append(hits[0])

    lines = ['[Memory Capsule]']
    for hit in selected_hits[:max_lines]:
        lines.append(_render_capsule_line(hit))

    text = '\n'.join(lines).strip()
    if len(text) > char_budget:
        text = text[: max(char_budget - 1, 0)].rstrip() + '…'

    avg_confidence = 0.0
    if selected_hits:
        avg_confidence = sum(float(item.get('score') or 0.0) for item in selected_hits) / len(selected_hits)

    return {
        'text': text,
        'hit_count': len(selected_hits),
        'hits': selected_hits,
        'retrieval_mode': base_context.get('retrieval_mode', 'lexical-fallback'),
        'focus_module': selected_hits[0].get('module_key') if selected_hits else None,
        'avg_confidence': round(float(avg_confidence), 3),
        'dropped_low_confidence': dropped_low_confidence,
    }


def _candidate_timestamp(hit: dict[str, Any]) -> str | None:
    dt = hit.get('updated_at')
    if hasattr(dt, 'isoformat'):
        try:
            return dt.isoformat()
        except Exception:
            return None
    return None


def build_structured_memory_capsule(
    question: str,
    memory_items: Iterable[Any] | None = None,
    summaries: Iterable[Any] | None = None,
    top_k: int = 5,
    min_confidence: float = DEFAULT_CAPSULE_MIN_CONFIDENCE,
) -> dict[str, Any]:
    base_capsule = build_minimum_continuation_capsule(
        question,
        memory_items=memory_items,
        summaries=summaries,
        char_budget=640,
        max_lines=top_k,
        min_confidence=min_confidence,
    )

    entries = []
    for hit in base_capsule.get('hits', []):
        entries.append({
            'type': 'episodic_memory',
            'source_type': hit.get('source_type'),
            'source_id': hit.get('source_id'),
            'module_key': hit.get('module_key') or 'general',
            'embedding': None,
            'summary': _truncate_text(hit.get('content') or hit.get('summary_text') or '', 180),
            'timestamp': _candidate_timestamp(hit),
            'importance': round(_importance_score(int(hit.get('importance') or 1)), 3),
            'relevance_score': round(float(hit.get('score') or 0.0), 3),
            'semantic_similarity': round(float(hit.get('semantic_score') or 0.0), 3) if hit.get('semantic_score') is not None else None,
            'task_alignment': round(float(hit.get('task_alignment') or 0.0), 3),
            'tags': [tag for tag in [hit.get('module_key'), hit.get('memory_type')] if tag],
        })

    return {
        'type': 'structured_memory_capsule',
        'retrieval_mode': base_capsule.get('retrieval_mode'),
        'focus_module': base_capsule.get('focus_module'),
        'avg_confidence': base_capsule.get('avg_confidence', 0.0),
        'entries': entries,
    }


def _entry_memory_kind(entry: dict[str, Any]) -> str:
    module_key = (entry.get('module_key') or '').lower()
    tags = {str(tag).lower() for tag in (entry.get('tags') or [])}
    if 'constraint' in module_key or 'constraint' in tags:
        return 'constraint'
    if module_key in {'tech_stack', 'project_scope', 'ui_style', 'payment', 'delivery'}:
        return 'decision'
    return 'fact'


def _summary_markers(summary: str) -> set[str]:
    text = (summary or '').lower()
    markers = set()
    if any(word in text for word in ('refine', 'improve', 'optimize', 'update', 'tweak', 'iyilestir', 'guncelle')):
        markers.add('refines')
    if any(word in text for word in ('replace', 'switch', 'migrate', 'change', 'swap', 'instead', 'gec', 'gecis')):
        markers.add('replaces')
    if any(word in text for word in ('invalid', 'not ', "don't", 'degil', 'asla', 'vazgec', 'ignore')):
        markers.add('invalidates')
    if any(word in text for word in ('support', 'back', 'enable', 'compatible', 'uyumlu', 'destek')):
        markers.add('supports')
    if any(word in text for word in ('derive', 'based on', 'from', 'turetil', 'alınan', 'alinan')):
        markers.add('derives_from')
    return markers


def _entry_id(entry: dict[str, Any]) -> str:
    source_type = entry.get('source_type') or 'memory'
    source_id = entry.get('source_id')
    module_key = entry.get('module_key') or 'general'
    if source_id is not None:
        return f'{source_type}:{source_id}'
    digest = hashlib.sha1(f"{module_key}:{entry.get('summary') or ''}".encode('utf-8')).hexdigest()[:12]
    return f'{source_type}:{digest}'


def _canonical_relation_type(relation_type: str | None) -> str:
    relation = (relation_type or '').strip().lower()
    if relation in RELATION_ONTOLOGY:
        return relation
    return RELATION_TYPE_ALIASES.get(relation, 'supports')


def _relation_family(relation_type: str | None) -> str:
    relation = _canonical_relation_type(relation_type)
    if relation in {'invalidates', 'replaces'}:
        return 'contradiction'
    if relation == 'refines':
        return 'refinement'
    if relation == 'derives_from':
        return 'derivation'
    return 'support'


def _infer_relation_type(source_node: dict[str, Any], target_node: dict[str, Any], *, same_module: bool) -> str:
    source_summary = source_node.get('summary') or ''
    target_summary = target_node.get('summary') or ''
    target_markers = _summary_markers(target_summary)
    source_markers = _summary_markers(source_summary)

    if 'invalidates' in target_markers or 'invalidates' in source_markers:
        return 'invalidates'
    if 'replaces' in target_markers:
        return 'replaces'
    if 'refines' in target_markers:
        return 'refines'
    if 'supports' in target_markers:
        return 'supports'
    if 'derives_from' in target_markers:
        return 'derives_from'
    if same_module:
        return 'supports' if source_node.get('type') == target_node.get('type') else 'refines'
    return 'supports'


def _compaction_audit(graph: dict[str, Any], compacted_graph: dict[str, Any]) -> dict[str, Any]:
    original_nodes = list(graph.get('nodes') or [])
    compacted_nodes = list(compacted_graph.get('nodes') or [])
    original_edges = list(graph.get('edges') or [])
    compacted_edges = list(compacted_graph.get('edges') or [])
    kept_node_ids = {node.get('id') for node in compacted_nodes}
    kept_edge_keys = {
        (edge.get('source_id'), edge.get('target_id'), edge.get('relation_type'))
        for edge in compacted_edges
    }

    pruned_nodes = []
    for node in original_nodes:
        if node.get('id') in kept_node_ids:
            continue
        pruned_nodes.append({
            'node_id': node.get('id'),
            'module_key': node.get('module_key'),
            'score': round(float(node.get('score') or 0.0), 3),
            'reason': 'low_priority_compaction',
        })

    pruned_edges = []
    for edge in original_edges:
        edge_key = (edge.get('source_id'), edge.get('target_id'), edge.get('relation_type'))
        if edge_key in kept_edge_keys:
            continue
        pruned_edges.append({
            'source_id': edge.get('source_id'),
            'target_id': edge.get('target_id'),
            'relation_type': edge.get('relation_type'),
            'relation_family': _relation_family(edge.get('relation_type')),
            'reason': 'edge_compaction',
        })

    pruned_nodes = pruned_nodes[:GRAPH_AUDIT_DETAIL_LIMIT]
    pruned_edges = pruned_edges[:GRAPH_AUDIT_DETAIL_LIMIT]

    return {
        'type': 'memory_compaction_audit',
        'source_node_count': len(original_nodes),
        'source_edge_count': len(original_edges),
        'kept_node_count': len(compacted_nodes),
        'kept_edge_count': len(compacted_edges),
        'pruned_node_count': len(pruned_nodes),
        'pruned_edge_count': len(pruned_edges),
        'pruned_nodes': pruned_nodes,
        'pruned_edges': pruned_edges,
        'collapsed_modules': compacted_graph.get('collapsed_modules') or [],
    }


def compact_memory_graph(graph: dict[str, Any], max_nodes: int = GRAPH_COMPACTION_NODE_LIMIT, max_edges: int = GRAPH_COMPACTION_EDGE_LIMIT) -> dict[str, Any]:
    nodes = list(graph.get('nodes') or [])
    edges = list(graph.get('edges') or [])
    if len(nodes) <= max_nodes and len(edges) <= max_edges:
        result = {
            'type': 'memory_graph_compaction',
            'source_node_count': len(nodes),
            'source_edge_count': len(edges),
            'kept_node_count': len(nodes),
            'kept_edge_count': len(edges),
            'pruned_node_count': 0,
            'pruned_edge_count': 0,
            'collapsed_modules': [],
            'nodes': nodes,
            'edges': edges,
        }
        result['audit'] = _compaction_audit(graph, result)
        return result

    ranked_nodes = sorted(nodes, key=_graph_priority, reverse=True)
    kept_ids: set[str] = set()
    for node in ranked_nodes:
        if len(kept_ids) >= max_nodes:
            break
        node_id = node.get('id')
        if not node_id:
            continue
        kept_ids.add(node_id)
        for dep_id in node.get('depends_on') or []:
            if len(kept_ids) >= max_nodes:
                break
            kept_ids.add(dep_id)

    compacted_nodes = [node for node in nodes if node.get('id') in kept_ids]
    compacted_nodes.sort(key=_graph_priority, reverse=True)
    kept_ids = {node['id'] for node in compacted_nodes}

    compacted_edges = [
        edge for edge in edges
        if edge.get('source_id') in kept_ids and edge.get('target_id') in kept_ids
    ]
    compacted_edges.sort(key=lambda edge: (edge.get('weight', 0.0), edge.get('relation_type') == 'invalidates'), reverse=True)
    compacted_edges = compacted_edges[:max_edges]

    collapsed_modules = sorted({node.get('module_key') for node in nodes if node.get('id') not in kept_ids and node.get('module_key')})

    result = {
        'type': 'memory_graph_compaction',
        'source_node_count': len(nodes),
        'source_edge_count': len(edges),
        'kept_node_count': len(compacted_nodes),
        'kept_edge_count': len(compacted_edges),
        'pruned_node_count': max(0, len(nodes) - len(compacted_nodes)),
        'pruned_edge_count': max(0, len(edges) - len(compacted_edges)),
        'collapsed_modules': collapsed_modules,
        'nodes': compacted_nodes,
        'edges': compacted_edges,
    }
    result['audit'] = _compaction_audit(graph, result)
    return result


def build_memory_graph(structured_capsule: dict[str, Any]) -> dict[str, Any]:
    entries = list(structured_capsule.get('entries') or [])
    nodes = []
    edges = []
    nodes_by_id: dict[str, dict[str, Any]] = {}

    for entry in entries:
        node = {
            'id': _entry_id(entry),
            'type': _entry_memory_kind(entry),
            'module_key': entry.get('module_key') or 'general',
            'summary': entry.get('summary') or '',
            'depends_on': [],
            'conflicts_with': [],
            'validity_state': 'active',
            'timestamp': entry.get('timestamp'),
            'score': float(entry.get('relevance_score') or 0.0),
        }
        nodes.append(node)
        nodes_by_id[node['id']] = node

    by_module: dict[str, list[dict[str, Any]]] = {}
    for node in nodes:
        by_module.setdefault(node['module_key'], []).append(node)

    # Create lineage edges and supersession state inside each module cluster.
    for module_nodes in by_module.values():
        module_nodes.sort(key=lambda item: ((item.get('timestamp') or ''), item.get('score', 0.0)), reverse=True)
        if not module_nodes:
            continue

        head = module_nodes[0]
        for older in module_nodes[1:]:
            head['depends_on'].append(older['id'])
            older['validity_state'] = 'superseded'
            relation_type = _infer_relation_type(older, head, same_module=True)
            edges.append({
                'source_id': older['id'],
                'target_id': head['id'],
                'relation_type': _canonical_relation_type(relation_type),
                'relation_family': _relation_family(relation_type),
                'relation_hint': relation_type,
                'weight': 1.0 if relation_type in {'invalidates', 'replaces'} else 0.9,
            })

    for node in nodes:
        for dep_id in node['depends_on']:
            source_node = nodes_by_id.get(dep_id, {})
            edges.append({
                'source_id': dep_id,
                'target_id': node['id'],
                'relation_type': _canonical_relation_type(_infer_relation_type(source_node, node, same_module=source_node.get('module_key') == node.get('module_key'))),
                'relation_family': _relation_family(_infer_relation_type(source_node, node, same_module=source_node.get('module_key') == node.get('module_key'))),
                'relation_hint': _infer_relation_type(source_node, node, same_module=source_node.get('module_key') == node.get('module_key')),
                'weight': 0.9,
            })

    # Add cross-node conflict hints for incompatible pairs.
    opposite_pairs = [
        ('react', 'vue'),
        ('react', 'angular'),
        ('tailwind', 'bootstrap'),
        ('dark mode', 'light mode'),
        ('postgres', 'mysql'),
    ]
    for node in nodes:
        low_summary = node.get('summary', '').lower()
        for other in nodes:
            if node['id'] == other['id']:
                continue
            other_summary = other.get('summary', '').lower()
            for left, right in opposite_pairs:
                if (left in low_summary and right in other_summary) or (right in low_summary and left in other_summary):
                    node['conflicts_with'].append(other['id'])
                    edges.append({
                        'source_id': node['id'],
                        'target_id': other['id'],
                        'relation_type': _canonical_relation_type('invalidates'),
                        'relation_family': _relation_family('invalidates'),
                        'relation_hint': 'invalidates',
                        'weight': 1.0,
                    })

    # De-duplicate edges while preserving order.
    deduped_edges = []
    seen_edges = set()
    for edge in edges:
        edge['relation_type'] = _canonical_relation_type(edge.get('relation_type'))
        edge['relation_family'] = edge.get('relation_family') or _relation_family(edge.get('relation_type'))
        edge['relation_hint'] = edge.get('relation_hint') or edge['relation_type']
        key = (edge['source_id'], edge['target_id'], edge['relation_type'])
        if key in seen_edges:
            continue
        seen_edges.add(key)
        deduped_edges.append(edge)

    return {
        'type': 'memory_graph',
        'nodes': nodes,
        'edges': deduped_edges,
        'node_count': len(nodes),
    }


def _graph_priority(node: dict[str, Any]) -> float:
    score = float(node.get('score') or 0.0)
    degree_bonus = 0.03 * len(node.get('depends_on') or [])
    conflict_penalty = 0.02 * len(node.get('conflicts_with') or [])
    return score + degree_bonus - conflict_penalty


def _graph_traversal(graph: dict[str, Any]) -> list[dict[str, Any]]:
    nodes = list(graph.get('nodes') or [])
    nodes_by_id = {node['id']: node for node in nodes}
    seed_nodes = sorted(nodes, key=_graph_priority, reverse=True)
    visited = set()
    traversal = []

    def visit(node_id: str, path: list[str]):
        if node_id in visited:
            return
        node = nodes_by_id.get(node_id)
        if not node:
            return

        visited.add(node_id)
        next_path = path + [node_id]
        traversal.append({
            'node_id': node_id,
            'module_key': node.get('module_key'),
            'path': next_path,
            'priority': round(_graph_priority(node), 3),
            'reason': 'dependency-first traversal',
        })

        for dep_id in sorted(node.get('depends_on') or [], key=lambda item: _graph_priority(nodes_by_id.get(item, {})), reverse=True):
            visit(dep_id, next_path)

    for seed in seed_nodes:
        visit(seed['id'], [])

    return traversal


def _classify_transition(question: str, hit: dict[str, Any]) -> str:
    q = (question or '').lower()
    content = (hit.get('content') or hit.get('summary_text') or '').lower()

    evolution_markers = (
        'gec', 'geciyoruz', 'switch', 'migrate', 'move to', 'artik', 'from', 'to', 'yerine',
    )
    refinement_markers = (
        'refine', 'improve', 'optimize', 'detaylandir', 'detay', 'ince ayar', 'fine tune',
    )
    contradiction_markers = (
        'not ', "don't", 'asla', 'degil', 'kullanmiyorum', 'ignore', 'vazgec',
    )

    opposite_pairs = [
        ('react', 'vue'),
        ('react', 'angular'),
        ('tailwind', 'bootstrap'),
        ('dark', 'light'),
        ('postgres', 'mysql'),
    ]

    conflict_pair = False
    for left, right in opposite_pairs:
        if (left in q and right in content) or (right in q and left in content):
            conflict_pair = True
            break

    shared_terms = [
        term for term in ('react', 'vue', 'angular', 'tailwind', 'bootstrap', 'flask', 'django', 'postgres', 'mysql')
        if term in q and term in content
    ]

    if conflict_pair and any(marker in q for marker in evolution_markers):
        return 'evolution'
    if (conflict_pair or shared_terms) and any(marker in q for marker in contradiction_markers):
        return 'contradiction'
    if any(marker in q for marker in refinement_markers):
        return 'refinement'

    return 'none'


def detect_memory_transitions(question: str, capsule_hits: Iterable[dict[str, Any]] | None) -> dict[str, Any]:
    hits = list(capsule_hits or [])
    transitions = []

    for hit in hits:
        transition_type = _classify_transition(question, hit)
        if transition_type == 'none':
            continue

        module_key = hit.get('module_key') or 'general'
        action = 'keep'
        if transition_type == 'contradiction':
            action = 'drop'
        elif transition_type == 'evolution':
            action = 'update'
        elif transition_type == 'refinement':
            action = 'merge'

        transitions.append({
            'module_key': module_key,
            'transition': transition_type,
            'action': action,
            'source_id': hit.get('source_id'),
        })

    return {
        'has_transition': bool(transitions),
        'transitions': transitions,
    }


def build_memory_retrieval_plan(
    question: str,
    memory_items: Iterable[Any] | None = None,
    summaries: Iterable[Any] | None = None,
    top_k: int = 5,
    min_confidence: float = DEFAULT_CAPSULE_MIN_CONFIDENCE,
) -> dict[str, Any]:
    structured_capsule = build_structured_memory_capsule(
        question,
        memory_items=memory_items,
        summaries=summaries,
        top_k=top_k,
        min_confidence=min_confidence,
    )
    graph = build_memory_graph(structured_capsule)
    compaction = compact_memory_graph(graph)
    traversal = _graph_traversal(compaction)

    # Rebuild light-weight hits from structured entries for transition logic.
    hits = [
        {
            'source_id': entry.get('source_id'),
            'module_key': entry.get('module_key'),
            'content': entry.get('summary'),
            'score': entry.get('relevance_score'),
        }
        for entry in structured_capsule.get('entries', [])
    ]
    transitions = detect_memory_transitions(question, hits)

    drop_modules = {
        item['module_key'] for item in transitions.get('transitions', [])
        if item.get('action') == 'drop'
    }
    update_modules = {
        item['module_key'] for item in transitions.get('transitions', [])
        if item.get('action') == 'update'
    }

    selected_entries = []
    entries_by_uid = {
        _entry_id(entry): entry
        for entry in structured_capsule.get('entries', [])
    }

    ordered_uids = [item['node_id'] for item in traversal]
    ordered_entries = [entries_by_uid[uid] for uid in ordered_uids if uid in entries_by_uid]
    if not ordered_entries:
        ordered_entries = list(structured_capsule.get('entries', []))

    for entry in ordered_entries:
        module_key = entry.get('module_key') or 'general'
        if module_key in drop_modules or module_key in update_modules:
            # For contradiction/evolution, stale memory should not be injected.
            continue
        selected_entries.append(entry)

    lines = ['[Memory Capsule]']
    for entry in selected_entries[:top_k]:
        label = _capsule_label(entry.get('module_key'))
        lines.append(f"- {label}: {entry.get('summary')} (score={float(entry.get('relevance_score') or 0.0):.2f})")

    text = '\n'.join(lines).strip() if len(lines) > 1 else ''

    debug_signals = {
        'type': 'memory_debug_signals',
        'graph_compaction_audit': compaction.get('audit'),
        'memory_replay_trace': {
            'type': 'memory_replay_trace',
            'source_node_count': graph.get('node_count', 0),
            'compacted_node_count': compaction.get('kept_node_count', 0),
            'compacted_edge_count': compaction.get('kept_edge_count', 0),
            'selected_node_ids': [item['node_id'] for item in traversal[:min(top_k, REPLAY_TRACE_NODE_LIMIT)]],
            'dropped_node_ids': [item['node_id'] for item in (compaction.get('audit') or {}).get('pruned_nodes', [])[:REPLAY_TRACE_NODE_LIMIT]],
            'dropped_node_count': len((compaction.get('audit') or {}).get('pruned_nodes', [])),
            'relation_types': sorted({edge.get('relation_type') for edge in compaction.get('edges', []) if edge.get('relation_type')}),
            'relation_families': sorted({edge.get('relation_family') for edge in compaction.get('edges', []) if edge.get('relation_family')}),
        },
    }

    learning_signals = {
        'type': 'memory_learning_signals',
        'selected_node_ids': [entry.get('source_id') for entry in selected_entries if entry.get('source_id') is not None],
        'selected_module_keys': [entry.get('module_key') for entry in selected_entries if entry.get('module_key')],
        'transition_actions': [item.get('action') for item in transitions.get('transitions', []) if item.get('action')],
        'focus_module': selected_entries[0].get('module_key') if selected_entries else None,
    }

    return {
        'type': 'memory_retrieval_plan',
        'plan_steps': [
            'query-understanding',
            'semantic-retrieval',
            'graph-linking',
            'state-transition-resolution',
            'final-injection',
        ],
        'structured_capsule': structured_capsule,
        'memory_graph': graph,
        'graph_compaction': compaction,
        'graph_compaction_audit': compaction.get('audit'),
        'graph_traversal': traversal,
        'transitions': transitions,
        'debug_signals': debug_signals,
        'learning_signals': learning_signals,
        'text': text,
        'hit_count': len(selected_entries),
        'hits': selected_entries,
        'retrieval_mode': structured_capsule.get('retrieval_mode'),
        'focus_module': selected_entries[0].get('module_key') if selected_entries else None,
        'memory_replay_trace': debug_signals['memory_replay_trace'],
    }


def detect_memory_conflicts(question: str, capsule_hits: Iterable[dict[str, Any]] | None) -> dict[str, Any]:
    transitions = detect_memory_transitions(question, capsule_hits)
    drops = [item for item in transitions.get('transitions', []) if item.get('action') == 'drop']
    return {
        'has_conflict': bool(drops),
        'conflicts': drops,
        'drop_module_keys': sorted({item.get('module_key') for item in drops if item.get('module_key')}),
    }
