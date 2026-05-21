# -*- coding: utf-8 -*-
"""Sprint 10G — Premium stylized architecture live QA (3 seeds)."""
from __future__ import annotations

import asyncio
import base64
import json
import os
import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(backend_dir.parent))

from backend.config import get_settings
from backend.services.mirror.mirror_image_provider import resolve_mirror_image_provider_name
from backend.services.mirror.mirror_image_service import generate_mirror_scene
from backend.services.mirror.openai_prompt_builder import build_openai_mirror_prompt
from backend.services.mirror.types import MirrorImageRequest

STYLIZED_LOCK = (
    "premium stylized cinematic character, mature and elegant, not photorealistic, "
    "not a real human portrait, not a bean mascot, not a toy, refined facial proportions, "
    "soft editorial 3D realism, high-end animated film character for adults"
)

ARCH_CORE = (
    "a premium stylized cinematic designer character, mature and elegant, softly 3D rendered, "
    "standing or sitting in a historic stone courtyard, studying material samples or sketching "
    "quietly, architecture remains visible and important, warm golden hour, refined fabric "
    "textures, soft editorial realism, not photorealistic, not a real person, not a bean mascot"
)

PROMPT_PARTS = [
    "premium soft 3D realism, cinematic architecture storytelling, warm golden hour nostalgic "
    "travel-like atmosphere, architecture remains visually important about 65 percent of frame",
    STYLIZED_LOCK,
    ARCH_CORE,
    "wide editorial architectural composition, 28mm or 35mm cinematic architectural lens feeling",
    "clean negative space on left for shareable card overlay",
    "stylized character on right or right-lower only, character about 25 to 35 percent of frame",
    "face softly stylized not photorealistic portrait",
    "historic stone courtyard, material samples, premium stylized architect designer character",
    "shareable premium EZA Mirror card mood warm cinematic light like travel scenes",
    "palette: stone gray, warm ivory, soft copper",
    "atmosphere: structured calm, light on stone and glass",
    "left upper and left-middle areas clean and low-detail for text overlay",
]

NEGATIVE = (
    "text, letters, numbers, logo, watermark, photorealistic portrait, real human photo, "
    "documentary portrait, fashion model photo, corporate headshot, bean mascot, round blob head, "
    "toy character, childish cartoon, Pixar child face, simple mascot, low-end 3D avatar, "
    "bean character, toy architect, mascot architect, childish architect, central portrait composition"
)

QUALITY_HINTS = [
    "EZA Mirror — premium stylized cinematic character",
    "not photorealistic portrait",
    "9:16 vertical safe composition",
]

SEEDS = ["stylized-01", "stylized-02", "stylized-03"]
OUT_DIR = backend_dir / "test_output" / "mirror_premium_stylized_architecture_qa"


async def run_one(seed: str, index: int) -> dict:
    prompt = ", ".join(PROMPT_PARTS)
    openai_prompt = build_openai_mirror_prompt(
        MirrorImageRequest(
            prompt=prompt,
            negative_prompt=NEGATIVE,
            seed_hint=f"mirror-stylized-arch-{seed}",
            style_preset="eza_mirror_professional_v1",
            card_date="2026-05-21",
            quality_hints=QUALITY_HINTS,
        )
    )
    result = await generate_mirror_scene(
        prompt=openai_prompt,
        negative_prompt=NEGATIVE,
        seed_hint=f"mirror-stylized-arch-{seed}",
        style_preset="eza_mirror_professional_v1",
        card_date="2026-05-21",
        quality_hints=QUALITY_HINTS,
    )
    out: dict = {"seed": seed, "provider": result.provider, "promptLen": len(openai_prompt)}
    if result.scene_image_url.startswith("data:image"):
        raw = base64.b64decode(result.scene_image_url.split(",", 1)[-1])
        path = OUT_DIR / f"architecture_{index:02d}.png"
        path.write_bytes(raw)
        out["saved"] = path.name
        out["bytes"] = len(raw)
    return out


async def main() -> None:
    os.environ.setdefault("EZA_MIRROR_IMAGE_PROVIDER", "openai")
    get_settings.cache_clear()
    if not (get_settings().OPENAI_API_KEY or "").strip():
        sys.exit("OPENAI_API_KEY missing")
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Sprint 10G | provider={resolve_mirror_image_provider_name()} | {OUT_DIR}")
    results = []
    for i, seed in enumerate(SEEDS, 1):
        print(f"generating {seed}...")
        try:
            row = await run_one(seed, i)
            results.append(row)
            print(f"  ok {row.get('saved')}")
        except Exception as exc:
            results.append({"seed": seed, "error": str(exc)[:300]})
            print(f"  FAIL: {exc}")
    (OUT_DIR / "summary.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(f"done: {sum(1 for r in results if r.get('saved'))}/3")


if __name__ == "__main__":
    asyncio.run(main())
