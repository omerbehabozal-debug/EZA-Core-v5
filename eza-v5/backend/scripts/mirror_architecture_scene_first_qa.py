# -*- coding: utf-8 -*-
"""
Sprint 10E — Architecture scene-first live QA (3 seeds, no character).
Run: cd eza-v5/backend && python scripts/mirror_architecture_scene_first_qa.py
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

# Mirrors frontend Sprint 10E architecture branch
EZA_ARCHITECTURE_STYLE = (
    "premium soft 3D realism, editorial architecture visualization, calm cinematic light, "
    "elegant pastel muted palette, strong material texture, high detail but uncluttered, "
    "shallow depth of field on materials, refined spatial atmosphere, no foreground character, "
    "no mascot, no animal character, no human character as main subject, architecture is the "
    "main subject, space, material, craft and light are the main focus, clean left side for UI "
    "overlay, no text, no typography, no letters, no numbers, no logo, no ui labels, no signage, "
    "no readable writing"
)

EZA_ARCHITECTURE_CAMERA = [
    "wide editorial architectural composition",
    "24mm or 35mm architectural lens feeling",
    "eye-level or slightly elevated camera",
    "strong material texture",
    "light and shadow geometry",
    "clean negative space on left",
    "no central portrait composition",
    "soft background depth",
]

EZA_ARCHITECTURE_SCENE = [
    "scene-first composition",
    "architecture-only scene no people no animals",
    "elegant courtyard historic stone facade",
    "material craft samples elegant shadows",
    "premium spatial editorial atmosphere",
    "refined architectural courtyard",
    "historic stone facade",
    "material samples wood stone ceramic",
    "elegant shadows",
    "premium spatial atmosphere",
    "editorial architecture visualization",
    "calm cinematic light",
    "left side clean for overlay",
    "bottom area calm for UI panels",
    "no central portrait composition",
    "prefer no figure at all",
    "empty courtyard or facade study, architecture remains sole subject",
]

EZA_ARCHITECTURE_OVERLAY = [
    "left upper and left-middle areas clean and low-detail for text overlay",
    "lower third calmer with softer detail for UI card overlay",
    "architecture and materials are the main subject",
    "environment calm without visual clutter",
    "no foreground figure blocking overlay zones",
]

ARCHITECTURE_NEGATIVE_EXTRA = (
    "foreground character, main character, mascot, animal character, human character in "
    "foreground, portrait subject, bean animal, cat mascot, toy architect, character dominating "
    "the frame, avatar, cartoon person, cute animal, construction toy, desk clutter, giant mascot "
    "architect, central portrait composition"
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
    "architecture scene-first — no foreground character",
    "editorial spatial visualization",
    "9:16 vertical safe composition",
    "left overlay zone kept clean",
]

SEEDS = ["architecture-01", "architecture-02", "architecture-03"]
OUT_DIR = backend_dir / "test_output" / "mirror_architecture_scene_first_qa"


def build_architecture_prompt() -> str:
    parts = [
        EZA_ARCHITECTURE_STYLE,
        *EZA_ARCHITECTURE_CAMERA,
        *EZA_ARCHITECTURE_SCENE,
        "palette: stone gray, warm ivory, soft copper",
        "atmosphere: structured calm, light on stone and glass",
        "spatial mood: dengeli ve meraklı",
        *EZA_ARCHITECTURE_OVERLAY,
    ]
    return ", ".join(parts)


def build_negative() -> str:
    return f"{STANDARD_NEGATIVE}, {ARCHITECTURE_NEGATIVE_EXTRA}"


async def run_one(seed: str, index: int) -> dict:
    prompt = build_architecture_prompt()
    negative = build_negative()
    openai_prompt = build_openai_mirror_prompt(
        MirrorImageRequest(
            prompt=prompt,
            negative_prompt=negative,
            seed_hint=f"mirror-arch-scene-{seed}",
            style_preset="eza_mirror_professional_v1",
            card_date="2026-05-21",
            quality_hints=QUALITY_HINTS,
        )
    )
    result = await generate_mirror_scene(
        prompt=openai_prompt,
        negative_prompt=negative,
        seed_hint=f"mirror-arch-scene-{seed}",
        style_preset="eza_mirror_professional_v1",
        card_date="2026-05-21",
        quality_hints=QUALITY_HINTS,
    )
    out: dict = {
        "seed": seed,
        "provider": result.provider,
        "promptLen": len(openai_prompt),
        "saved": None,
    }
    url = result.scene_image_url
    if url.startswith("data:image"):
        raw = base64.b64decode(url.split(",", 1)[-1])
        path = OUT_DIR / f"architecture_{index:02d}.png"
        path.write_bytes(raw)
        out["saved"] = path.name
        out["bytes"] = len(raw)
    return out


async def main() -> None:
    os.environ.setdefault("EZA_MIRROR_IMAGE_PROVIDER", "openai")
    get_settings.cache_clear()
    settings = get_settings()
    if not (settings.OPENAI_API_KEY or "").strip():
        print("ERROR: OPENAI_API_KEY missing")
        sys.exit(1)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print(
        f"Sprint 10E architecture QA | provider={resolve_mirror_image_provider_name()} "
        f"model={settings.EZA_MIRROR_OPENAI_IMAGE_MODEL}"
    )
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
    ok = sum(1 for r in results if r.get("provider") == "openai" and r.get("saved"))
    print(f"done: {ok}/{len(SEEDS)} saved")


if __name__ == "__main__":
    asyncio.run(main())
