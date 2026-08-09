# -*- coding: utf-8 -*-
"""CLI helper: run scoped Journey live prepare and print JSON for frontend closure tests."""

from __future__ import annotations

import asyncio
import json
import os
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[2]  # eza-v5/backend
EZA_V5_ROOT = BACKEND_ROOT.parent  # eza-v5 (package root for `import backend`)
REPO_TESTS = Path(__file__).resolve().parents[1]
for p in (EZA_V5_ROOT, BACKEND_ROOT, REPO_TESTS):
    if str(p) not in sys.path:
        sys.path.insert(0, str(p))

os.environ.setdefault("EZA_MIRROR_DIRECTOR_MODE", "FULL")


async def _run() -> dict:
    # Import test helpers by path (tests/ is not always a package).
    import importlib.util

    live_path = REPO_TESTS / "test_mirror_journey_scoped_d2_live_prepare.py"
    spec = importlib.util.spec_from_file_location(
        "test_mirror_journey_scoped_d2_live_prepare", live_path
    )
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)

    from backend.services.mirror.journey_semantic_scope import (
        append_journey_scope_key,
        validate_journey_semantic_scope,
    )
    from backend.services.mirror.mirror_director_prepare import prepare_mirror_director_draft
    from backend.services.mirror.mirror_director_prepare_cache import cache_clear_for_tests

    cache_clear_for_tests()
    steps = mod._bmw_steps()
    messages = mod._messages_from_steps(steps)
    scope = mod._scope_payload(steps)
    meta = validate_journey_semantic_scope(
        journey_scope=scope,
        messages=[m.model_dump() for m in messages],
    )

    async def interpretation_completer(request_body: dict):
        content = mod.reflective_interpretation_from_llm_payload(request_body)
        return {"choices": [{"message": {"content": json.dumps(content, ensure_ascii=False)}}]}

    out = await prepare_mirror_director_draft(
        conversation_id="conv-live-scoped",
        generation_request_id="req-live-runner-b1",
        messages=list(messages),
        title=None,
        conversation_summary=None,
        scope_key=append_journey_scope_key("user:live-runner", meta),
        interpretation_completer=interpretation_completer,
    )
    cache_clear_for_tests()
    return {
        "windowHash": scope["windowHash"],
        "scopedInputHash": scope["scopedInputHash"],
        "contentHash": out.contentHash,
        "interpretationSource": out.interpretationSource,
        "finalInterpretation": (
            out.finalInterpretation.model_dump() if out.finalInterpretation else None
        ),
        "mappedPrompt": out.mappedPrompt.model_dump() if out.mappedPrompt else None,
        "conversationContext": (
            out.conversationContext.model_dump() if out.conversationContext else None
        ),
        "scopedMessages": [m.model_dump() for m in messages],
        "journeyId": scope["journeyId"],
    }


def main() -> None:
    payload = asyncio.run(_run())
    sys.stdout.write(json.dumps(payload, ensure_ascii=False))


if __name__ == "__main__":
    main()
