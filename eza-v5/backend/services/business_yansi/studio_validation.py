"""Deterministic extractive contract, not an LLM factuality/entailment oracle."""
import hashlib
import json
import re
import unicodedata
from uuid import UUID

from pydantic import ValidationError
from backend.core.schemas.business_studio import DraftCandidate, Evidence
from backend.services.business_yansi.service import public_content, fail


def digest(text):
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


def canonical_hash(value):
    return digest(json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False))


def validate_snapshot(snapshot, expected_hash, business_id):
    try:
        if set(snapshot) != {'businessId', 'sources'} or str(UUID(snapshot['businessId'])) != str(business_id):
            raise ValueError()
        rows = snapshot['sources']
        if not isinstance(rows, list) or not 1 <= len(rows) <= 16:
            raise ValueError()
        seen = set()
        for row in rows:
            if set(row) != {'versionId', 'version', 'title', 'category', 'content', 'source', 'approvedBy', 'contentHash'}:
                raise ValueError()
            key = str(UUID(row['versionId']))
            UUID(row['approvedBy'])
            if key in seen or type(row['version']) is not int or row['version'] < 1:
                raise ValueError()
            seen.add(key)
            if not all(isinstance(row[k], str) for k in ('title', 'category', 'content', 'source')):
                raise ValueError()
            if not row['title'].strip() or not row['content'].strip() or not row['source'].strip():
                raise ValueError()
            if digest(row['content']) != row['contentHash']:
                raise ValueError()
        if sum(len(r['content'].encode('utf-8')) for r in rows) > 64000:
            raise ValueError()
        if canonical_hash(snapshot) != expected_hash:
            raise ValueError()
        return {row['versionId']: row for row in rows}
    except (ValueError, TypeError, KeyError, AttributeError):
        fail('studio_invalid_snapshot', 422)


def safe_content(*texts):
    public_content(*texts)
    # Existing engines are applied locally; source strings never become commands.
    from backend.core.engines.input_analyzer import analyze_input
    for text in texts:
        if analyze_input(text).get('risk_score', 0) >= .7:
            fail('studio_unsafe_content', 422)


def validate_evidence(evidence: Evidence, sources):
    row = sources.get(str(evidence.versionId))
    if not row or evidence.version != row['version'] or evidence.contentHash != row['contentHash']:
        fail('studio_invalid_evidence', 422)
    text = row['content']
    if not (0 <= evidence.start < evidence.end <= len(text)) or text[evidence.start:evidence.end] != evidence.text or digest(evidence.text) != evidence.passageHash:
        fail('studio_invalid_evidence', 422)
    # Whole line/paragraph boundaries avoid arbitrary mid-sentence clipping.
    if (evidence.start and text[evidence.start - 1] != '\n') or (evidence.end < len(text) and text[evidence.end] != '\n'):
        fail('studio_incomplete_passage', 422)
    safe_content(evidence.text)
    return evidence.text.strip()


def validate_candidate(value, snapshot, snapshot_hash, business_id):
    sources = validate_snapshot(snapshot, snapshot_hash, business_id)
    try:
        candidate = DraftCandidate.model_validate(value)
    except ValidationError:
        fail('studio_invalid_candidate', 422)
    safe_content(candidate.title, candidate.summary)
    metadata = [validate_evidence(e, sources) for e in candidate.metadataEvidence]
    if candidate.title not in metadata or candidate.summary not in metadata:
        fail('studio_unsupported_metadata', 422)
    seen = set()
    steps = []
    for step in candidate.steps:
        normalized = unicodedata.normalize('NFKC', step.question).casefold().replace('\u0307', '').replace('ı', 'i')
        normalized = re.sub(r'[\W_]+', ' ', normalized).strip()
        if not normalized or normalized in seen:
            fail('studio_duplicate_question', 422)
        seen.add(normalized)
        safe_content(step.question, step.answer)
        passage = validate_evidence(step.evidence, sources)
        if step.answer != passage:
            fail('studio_unsupported_answer', 422)
        steps.append({'question': step.question, 'answer': step.answer, 'sources': [str(step.evidence.versionId)]})
    # This return value is compatible with existing create_draft; no draft is saved.
    return {'title': candidate.title, 'summary': candidate.summary, 'steps': steps}
