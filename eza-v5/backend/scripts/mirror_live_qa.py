# -*- coding: utf-8 -*-
"""
Live QA: generate one mirror scene per topic via OpenAI provider.
Run: cd eza-v5/backend && python scripts/mirror_live_qa.py
"""
from __future__ import annotations

import asyncio
import base64
import json
import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(backend_dir.parent))

from backend.config import get_settings
from backend.services.mirror.mirror_image_provider import resolve_mirror_image_provider_name
from backend.services.mirror.mirror_image_service import generate_mirror_scene
from backend.services.mirror.openai_prompt_builder import build_openai_mirror_prompt
from backend.services.mirror.types import MirrorImageRequest

STYLE_CONTRACT = (
    "premium soft 3D illustration, cinematic but calm, elegant pastel color palette, "
    "warm natural light, refined character design, high detail but uncluttered, "
    "emotional storytelling scene, soft depth of field, polished product illustration, "
    "clean left side for UI overlay, vertical 9:16 friendly composition, no text, "
    "no typography, no letters, no numbers, no logo, no signage, no readable writing"
)

NEGATIVE = (
    "text, letters, numbers, logo, watermark, signage, readable writing, captions, "
    "UI labels, distorted anatomy, extra limbs, broken hands, creepy face, messy "
    "background, cluttered dashboard, harsh contrast, dark gaming card style, low "
    "quality, blurry, noisy, flat cartoon, cheap sticker style, over saturated colors"
)

TOPIC_SCENES: dict[str, list[str]] = {
    "finance": [
        "city terrace at golden hour",
        "quiet modern skyline",
        "marble cafe table",
        "green and gold tones",
        "calm planning mood",
    ],
    "health": [
        "wellness garden",
        "morning light",
        "calm lake or seaside path",
        "soft green and lavender tones",
        "restorative mood",
    ],
    "friendship": [
        "park bridge",
        "lakeside path",
        "sunset",
        "warm purple and peach tones",
        "reconciliation and empathy mood",
    ],
    "travel": [
        "historic city",
        "train station",
        "old streets",
        "horizon line",
        "discovery mood",
        "warm sand and blue tones",
    ],
    "architecture": [
        "quiet courtyard",
        "historic facade",
        "modern material samples",
        "sunlight and shadows",
        "elegant spatial mood",
    ],
}

TOPIC_LABELS = {
    "finance": "finans",
    "health": "sağlık",
    "friendship": "arkadaşlık",
    "travel": "seyahat",
    "architecture": "mimari",
}

OUT_DIR = backend_dir / "test_output" / "mirror_live_qa"


def build_topic_prompt(topic_key: str) -> str:
    scene = ", ".join([STYLE_CONTRACT, *TOPIC_SCENES[topic_key]])
    scene += (
        ", main character on the right side or right-center of the frame, "
        "left upper and left-middle areas clean and low-detail for text overlay, "
        "friendly, intelligent, warm, non-creepy, expressive eyes, "
        "premium mascot-like but not childish, high quality 3D illustration"
    )
    req = MirrorImageRequest(
        prompt=scene,
        negative_prompt=NEGATIVE,
        seed_hint=f"mirror-qa-{topic_key}",
        style_preset="eza_mirror_professional_v1",
        card_date="2026-05-21",
        quality_hints=["9:16 vertical safe composition", "textless scene only"],
    )
    return build_openai_mirror_prompt(req)


async def run_one(topic_key: str) -> dict:
    prompt = build_topic_prompt(topic_key)
    result = await generate_mirror_scene(
        prompt=prompt,
        negative_prompt=NEGATIVE,
        seed_hint=f"mirror-qa-{topic_key}",
        style_preset="eza_mirror_professional_v1",
        card_date="2026-05-21",
        quality_hints=["9:16 vertical safe composition"],
    )
    out: dict = {
        "topic": TOPIC_LABELS[topic_key],
        "topicKey": topic_key,
        "provider": result.provider,
        "urlKind": "unknown",
        "saved": None,
        "promptLen": len(prompt),
    }
    url = result.scene_image_url
    if url.startswith("data:image"):
        out["urlKind"] = "data_url"
        b64 = url.split(",", 1)[-1]
        raw = base64.b64decode(b64)
        path = OUT_DIR / f"{topic_key}.png"
        path.write_bytes(raw)
        out["saved"] = str(path.name)
        out["bytes"] = len(raw)
    elif url.startswith("http"):
        out["urlKind"] = "https"
        out["saved"] = url[:80] + "..."
    return out


async def main() -> None:
    get_settings.cache_clear()
    provider_name = resolve_mirror_image_provider_name()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"provider={provider_name} model={get_settings().EZA_MIRROR_OPENAI_IMAGE_MODEL}")
    results = []
    for topic_key in TOPIC_SCENES:
        print(f"generating: {TOPIC_LABELS[topic_key]}...")
        try:
            row = await run_one(topic_key)
            results.append(row)
            print(f"  ok provider={row['provider']} kind={row['urlKind']} file={row.get('saved')}")
        except Exception as exc:
            results.append(
                {"topic": TOPIC_LABELS[topic_key], "topicKey": topic_key, "error": str(exc)[:200]}
            )
            print(f"  FAIL: {type(exc).__name__}")
    (OUT_DIR / "summary.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
    ok = sum(1 for r in results if "error" not in r and r.get("provider") == "openai")
    print(f"done: {ok}/{len(results)} openai successes -> {OUT_DIR}")


if __name__ == "__main__":
    asyncio.run(main())
