# -*- coding: utf-8 -*-
"""
Sprint 10F — Architecture cinematic storytelling live QA (3 seeds).
Run: cd eza-v5/backend && python scripts/mirror_architecture_storytelling_qa.py
"""
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

EZA_GLOBAL_STYLE_LOCK = (
    "EZA unified world: mature premium editorial character, refined cinematic 3D realism, "
    "elegant proportions, not toy-like not bean-like not plush not plastic mascot not childish "
    "not generic avatar, high-end animated film quality for adults, premium collectible character "
    "not a children's toy"
)

EZA_ARCHITECTURE_STYLE = (
    "premium soft 3D realism, cinematic architecture storytelling, architecture editorial "
    "photography feeling, premium architectural lifestyle mood, contemplative designer atmosphere, "
    "emotional spatial atmosphere, calm cinematic golden-hour or soft diffused light, elegant "
    "pastel muted palette, strong material texture, high detail but uncluttered, refined spatial "
    "atmosphere, architecture remains visually important about 65 percent of frame, character "
    "integrated into environment not dominating, clean left side for UI overlay, no text, no "
    "typography, no letters, no numbers, no logo, no ui labels, no signage, no readable writing"
)

EZA_ARCHITECTURE_CAMERA = [
    "wide editorial architectural composition",
    "28mm or 35mm cinematic architectural lens feeling",
    "eye-level or slightly elevated camera",
    "strong material texture and spatial depth",
    "clean negative space on left",
    "integrated human presence on right-lower or right-center",
    "character about 20 to 35 percent of frame",
    "architecture about 65 percent of frame",
    "not central portrait composition",
    "soft background depth",
]

EZA_ARCHITECTURE_SCENE = [
    "cinematic architecture storytelling",
    "historic stone courtyard at golden hour",
    "material craft samples elegant shadows",
    "contemplative designer mood integrated in space",
    "cinematic architecture storytelling composition",
    "refined architectural courtyard historic stone facade",
    "material samples wood stone ceramic",
    "thoughtful architect in stone courtyard",
    "calm designer examining material samples",
    "EZA architecture storytelling character",
    "calm architectural thinker",
    "refined designer presence",
    "elegant observer integrated into environment",
    "subtle emotional expression",
    "cinematic human presence",
    "mature premium editorial character",
    "not dominating the frame",
    "character and architecture share one premium editorial story",
    "not a cold architectural render website image",
]

EZA_ARCHITECTURE_OVERLAY = [
    "left upper and left-middle areas clean and low-detail for text overlay",
    "lower third calmer with softer detail for UI card overlay",
    "courtyard facade and materials remain visually strong",
    "character supports story without blocking overlay zones",
]

ARCHITECTURE_NEGATIVE_EXTRA = (
    "bean animal, cat mascot, toy architect, mascot architect, giant foreground character, "
    "character dominating the frame, cartoon construction worker, childish architect, "
    "childish character, generic avatar, bean character, cartoon person, cute animal, "
    "construction toy, central portrait composition, plastic mascot"
)

STANDARD_NEGATIVE = (
    "text, letters, numbers, logo, watermark, signage, readable writing, captions, UI labels, "
    "distorted anatomy, extra limbs, broken hands, creepy face, messy background, cluttered "
    "dashboard, harsh contrast, dark gaming card style, low quality, blurry, noisy, flat cartoon, "
    "cheap sticker style, over saturated colors, childish, toy, bean character, baby face, "
    "cartoonish simple, low detail, overly cute, generic avatar, flat character, cheap 3D, "
    "plastic mascot, chibi, emoji style"
)

QUALITY_HINTS = [
    "EZA Mirror — cinematic architecture storytelling",
    "character and space balanced",
    "9:16 vertical safe composition",
    "left overlay zone kept clean",
    "not toy-like not bean-like",
]

SEEDS = ["story-01", "story-02", "story-03"]
OUT_DIR = backend_dir / "test_output" / "mirror_architecture_storytelling_qa"


def build_prompt() -> str:
    return ", ".join(
        [
            EZA_ARCHITECTURE_STYLE,
            EZA_GLOBAL_STYLE_LOCK,
            *EZA_ARCHITECTURE_CAMERA,
            *EZA_ARCHITECTURE_SCENE,
            "palette: stone gray, warm ivory, soft copper",
            "atmosphere: structured calm, light on stone and glass",
            "emotion mood: dengeli ve meraklı",
            "behavior-inspired presence: Mekan Gözlemcisi, thoughtful figure in this space",
            *EZA_ARCHITECTURE_OVERLAY,
        ]
    )


def build_negative() -> str:
    return f"{STANDARD_NEGATIVE}, {ARCHITECTURE_NEGATIVE_EXTRA}"


async def run_one(seed: str, index: int) -> dict:
    prompt = build_prompt()
    negative = build_negative()
    openai_prompt = build_openai_mirror_prompt(
        MirrorImageRequest(
            prompt=prompt,
            negative_prompt=negative,
            seed_hint=f"mirror-arch-story-{seed}",
            style_preset="eza_mirror_professional_v1",
            card_date="2026-05-21",
            quality_hints=QUALITY_HINTS,
        )
    )
    result = await generate_mirror_scene(
        prompt=openai_prompt,
        negative_prompt=negative,
        seed_hint=f"mirror-arch-story-{seed}",
        style_preset="eza_mirror_professional_v1",
        card_date="2026-05-21",
        quality_hints=QUALITY_HINTS,
    )
    out: dict = {"seed": seed, "provider": result.provider, "promptLen": len(openai_prompt), "saved": None}
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
        print("ERROR: OPENAI_API_KEY missing")
        sys.exit(1)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Sprint 10F storytelling QA | provider={resolve_mirror_image_provider_name()}")
    print(f"output={OUT_DIR}")

    results = []
    for i, seed in enumerate(SEEDS, start=1):
        print(f"generating {seed}...")
        try:
            row = await run_one(seed, i)
            results.append(row)
            print(f"  ok file={row.get('saved')} bytes={row.get('bytes', 'n/a')}")
        except Exception as exc:
            results.append({"seed": seed, "error": str(exc)[:300]})
            print(f"  FAIL: {exc}")

    (OUT_DIR / "summary.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
    ok = sum(1 for r in results if r.get("saved"))
    print(f"done: {ok}/{len(SEEDS)} saved")


if __name__ == "__main__":
    asyncio.run(main())
