# -*- coding: utf-8 -*-
"""
Sprint 10D — Style Lock live QA (Visual Canon + Character Bible, production-equivalent).
Run: cd eza-v5/backend && python scripts/mirror_visual_canon_qa.py
Requires: EZA_MIRROR_IMAGE_PROVIDER=openai, OPENAI_API_KEY in .env
Output: test_output/mirror_style_lock_qa/
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

# --- Mirrors frontend lib/eza/mirror (Sprint 10D) — QA-only, not product code ---

EZA_GLOBAL_STYLE_LOCK = (
    "EZA unified world: mature premium editorial character, refined cinematic 3D realism, "
    "elegant proportions, not toy-like not bean-like not plush not plastic mascot not childish "
    "not generic avatar, high-end animated film quality for adults, premium collectible character "
    "not a children's toy"
)

TRAVEL_NEGATIVE_EXTRA = (
    "bean head, round blob character, felt toy, toddler proportions, simplified mascot traveler, "
    "toy explorer"
)

ARCHITECTURE_NEGATIVE_EXTRA = (
    "giant mascot architect, character dominating the frame, cartoon architect, "
    "toy construction figure, crowded desk scene"
)

EZA_ARCHITECTURE_SCENE = [
    "scene-first composition",
    "elegant architectural courtyard",
    "historic stone facade",
    "material samples wood stone ceramic",
    "light and shadow",
    "refined spatial atmosphere",
    "character optional small secondary on right-center",
    "human or animal character should not dominate",
    "focus on space material craft and light",
    "optional small calm companion figure only, architecture remains primary subject",
]

EZA_ARCHITECTURE_CAMERA = [
    "wide to medium architectural framing",
    "eye-level camera",
    "cinematic depth",
    "soft background blur",
    "small optional figure on right or center-right only",
    "left side clean for text overlay",
    "bottom area calm for UI panels",
]

EZA_ARCHITECTURE_OVERLAY = [
    "left upper and left-middle areas clean and low-detail for text overlay",
    "lower third calmer with softer detail for UI card overlay",
    "architecture and materials are the main subject",
    "environment calm without visual clutter",
]

EZA_VISUAL_DNA = [
    "premium soft 3D realism",
    "editorial character illustration",
    "calm cinematic atmosphere",
    "warm golden-hour or soft diffused light",
    "elegant pastel muted palette",
    "elegant natural materials",
    "emotional but not childish",
    "intelligent and warm expression",
    "high detail but uncluttered",
    "shallow depth of field",
    "refined character design",
    "collectible premium product illustration",
    "no toy-like simplicity",
    "no cheap sticker style",
    "no childish cartoon look",
    "no plastic mascot look",
]

EZA_CAMERA = [
    "medium shot or medium close-up",
    "eye-level camera",
    "70mm or 85mm editorial portrait feeling",
    "cinematic depth",
    "soft background blur",
    "character on the right or center-right of frame",
    "left side clean for text overlay",
    "bottom area calm for UI panels",
]

EZA_MATERIAL_USE = [
    "natural fabric",
    "wool linen cashmere texture feeling",
    "wood and stone",
    "matte ceramic",
    "soft metal accents",
    "quality notebook book accessories",
    "natural plants",
    "warm paper textures",
    "soft realistic material detail",
]

EZA_EMOTIONAL_USE = [
    "calm",
    "wise",
    "non-judgmental",
    "trustworthy",
    "empathetic",
    "sincere",
    "peaceful",
    "elegant emotional expression",
]

EZA_QUALITY_RULES = [
    "not a toy",
    "not a child mascot",
    "mature premium editorial character",
    "refined proportions",
    "high-end animated film quality but not childish",
    "premium collectible character design",
    "not bean-like",
    "not plush",
    "soft realistic material detail",
    "no generic avatar",
    "no bean character",
    "no sticker illustration",
]

EZA_TEXTLESS = [
    "no text",
    "no typography",
    "no letters",
    "no numbers",
    "no logo",
    "no ui labels",
    "no signage",
    "no readable writing",
]

EZA_OVERLAY = [
    "left upper and left-middle areas clean and low-detail for text overlay",
    "lower third calmer with softer detail for UI card overlay",
    "uncluttered scene with one clear emotional main character",
    "environment reflects topic mood without visual clutter",
]

STANDARD_NEGATIVE = (
    "text, letters, numbers, logo, watermark, signage, readable writing, captions, UI labels, "
    "distorted anatomy, extra limbs, broken hands, creepy face, messy background, cluttered "
    "dashboard, harsh contrast, dark gaming card style, low quality, blurry, noisy, flat cartoon, "
    "cheap sticker style, over saturated colors, childish, toy, plastic toy, cheap mascot, sticker, "
    "bean character, baby face, cartoonish simple, low detail, overly cute, exaggerated cartoon "
    "proportions, generic avatar, flat character, cheap 3D, plastic mascot, chibi, emoji style, "
    "plastic toy surfaces, glossy cheap 3D, neon game aesthetic, low detail surfaces, overly simple "
    "figure, child toy character materials, comedic child character, overly cute toy, caricature, "
    "meme character"
)

QUALITY_HINTS = [
    "EZA visual canon — mature editorial character",
    "pastel cinematic lighting",
    "soft depth of field",
    "textless scene only — card copy rendered in frontend",
    "9:16 vertical safe composition",
    "left overlay zone kept clean",
    "not toy-like not childish",
]

ARCHETYPES: dict[str, dict] = {
    "compassionate_deer": {
        "display": "Şefkatli Geyik",
        "visual": [
            "elegant deer character with soft expressive eyes",
            "cream and lavender natural fabric",
            "wellness and nature atmosphere",
            "calm grounded posture",
            "premium editorial animal portrait",
        ],
        "avoid": "doctor costume caricature, child plush toy deer, overly cute mascot deer",
    },
    "wise_owl": {
        "display": "Bilgeli Baykuş",
        "visual": [
            "academic but modern owl character",
            "quality coat fabric notebook props",
            "city terrace or quiet library mood",
            "green gold cream tones",
            "calm strategic atmosphere",
        ],
        "avoid": "comic owl mascot, toy bird, dark harsh finance mood, cheap mascot owl",
    },
    "bridge_builder": {
        "display": "Köprü Kurucu",
        "visual": [
            "warm refined human bridge-builder character",
            "mature young adult refined facial structure",
            "calm emotional expression premium editorial design",
            "lavender and peach sunset tones",
            "park bridge lakeside empathy mood",
            "not childlike face not generic avatar not cartoon child",
        ],
        "avoid": "cartoon human avatar, child face proportions, Pixar child character, anime child face, generic dating app avatar, bean character",
        "closing": "single mature premium editorial character in scene",
    },
    "journey_traveler": {
        "display": "Keşif Yolcusu",
        "visual": [
            "refined adult traveler character",
            "elegant explorer silhouette mature facial proportions",
            "expressive but subtle eyes",
            "layered travel clothing natural fabric textures",
            "scarf coat small leather backpack",
            "cinematic train station or old city",
            "not round bean head not felt toy skin",
            "not simplified mascot body not toddler-like proportions",
        ],
        "avoid": "simple bean traveler, round blob character, felt toy skin, toy traveler, child train toy, plastic toy figure, sticker tourist, simplified mascot explorer",
        "closing": "single refined adult traveler in scene, not a toy explorer",
    },
}

TOPIC_CONFIG: dict[str, dict] = {
    "finance": {
        "label": "Finans",
        "archetype": "wise_owl",
        "character": "Bilgeli Baykuş",
        "scene": [
            "city terrace golden hour",
            "quiet skyline green gold cream",
            "marble table calm planning",
            "Bilgeli Baykuş strategic atmosphere",
            "editorial finance calm not dark",
        ],
        "palette": "muted green, warm gold, soft cream",
        "atmosphere": "thoughtful golden-hour planning, steady and clear",
        "emotion": "dengeli ve meraklı",
    },
    "health": {
        "label": "Sağlık",
        "archetype": "compassionate_deer",
        "character": "Şefkatli Geyik",
        "scene": [
            "wellness path and calm lake",
            "lavender morning light",
            "nature cream lavender green",
            "restorative body-mind balance mood",
            "Şefkatli Geyik canon atmosphere",
        ],
        "palette": "soft green, lavender, sky blue, cream white",
        "atmosphere": "fresh morning wellness, gentle and restorative",
        "emotion": "dengeli ve meraklı",
    },
    "friendship": {
        "label": "Arkadaşlık",
        "archetype": "bridge_builder",
        "character": "Köprü Kurucu",
        "scene": [
            "park bridge lakeside sunset",
            "warm purple peach reconciliation",
            "Köprü Kurucu empathy connection mood",
            "gentle communication atmosphere",
        ],
        "palette": "warm purple, soft peach, sage green",
        "atmosphere": "gentle connection, trust and empathy",
        "emotion": "dengeli ve meraklı",
    },
    "travel": {
        "label": "Seyahat",
        "archetype": "journey_traveler",
        "character": "Keşif Yolcusu",
        "scene": [
            "train station historic city",
            "old streets horizon discovery",
            "warm sand blue gold light",
            "Keşif Yolcusu journey mood",
            "not round bean head not felt toy traveler",
        ],
        "palette": "warm sand, dusty blue, soft amber",
        "atmosphere": "curious journey, open horizon",
        "emotion": "dengeli ve meraklı",
    },
    "architecture": {
        "label": "Mimari",
        "scene_first": True,
        "scene": [
            "scene-first architectural composition",
            "elegant courtyard historic stone facade",
            "material craft samples light and shadow",
            "refined spatial atmosphere space over character",
        ],
        "palette": "stone gray, warm ivory, soft copper",
        "atmosphere": "structured calm, light on stone and glass",
        "emotion": "dengeli ve meraklı",
    },
}

OUT_DIR = backend_dir / "test_output" / "mirror_style_lock_qa"


def _style_contract() -> str:
    parts = [
        *EZA_VISUAL_DNA,
        "clean left side for UI overlay",
        *EZA_TEXTLESS,
        "vertical 9:16 friendly composition",
    ]
    return ", ".join(parts)


def _canon_layers() -> list[str]:
    return [
        _style_contract(),
        EZA_GLOBAL_STYLE_LOCK,
        *EZA_CAMERA,
        f"materials: {', '.join(EZA_MATERIAL_USE)}",
        f"emotional tone: {', '.join(EZA_EMOTIONAL_USE)}",
        *EZA_QUALITY_RULES,
    ]


def _character_bible(archetype_id: str, character_name: str) -> str:
    entry = ARCHETYPES[archetype_id]
    presence = (
        f"behavior-inspired presence: {character_name}, same EZA canon character family"
        if character_name.strip()
        else "EZA canon character"
    )
    closing = entry.get("closing", "single mature premium editorial character in scene")
    return ", ".join(
        [
            f"EZA character archetype: {entry['display']}",
            *entry["visual"],
            f"avoid: {entry['avoid']}",
            presence,
            closing,
        ]
    )


def _topic_negative(topic_key: str) -> str:
    if topic_key == "travel":
        return f"{STANDARD_NEGATIVE}, {TRAVEL_NEGATIVE_EXTRA}"
    if topic_key == "architecture":
        return f"{STANDARD_NEGATIVE}, {ARCHITECTURE_NEGATIVE_EXTRA}"
    return STANDARD_NEGATIVE


def build_canon_topic_prompt(topic_key: str) -> tuple[str, str]:
    cfg = TOPIC_CONFIG[topic_key]
    common = [
        f"palette: {cfg['palette']}",
        f"atmosphere: {cfg['atmosphere']}",
        f"emotion mood: {cfg['emotion']}",
    ]
    if cfg.get("scene_first"):
        scene_block = [
            _style_contract(),
            EZA_GLOBAL_STYLE_LOCK,
            *EZA_ARCHITECTURE_CAMERA,
            *cfg["scene"],
            *EZA_ARCHITECTURE_SCENE,
            *common,
            *EZA_ARCHITECTURE_OVERLAY,
        ]
    else:
        scene_block = [
            *_canon_layers(),
            *cfg["scene"],
            *common,
            _character_bible(cfg["archetype"], cfg["character"]),
            *EZA_OVERLAY,
        ]
    prompt = ", ".join(scene_block)
    return prompt, _topic_negative(topic_key)


def build_openai_prompt(topic_key: str) -> str:
    prompt, negative = build_canon_topic_prompt(topic_key)
    req = MirrorImageRequest(
        prompt=prompt,
        negative_prompt=negative,
        seed_hint=f"mirror-style-lock-qa-{topic_key}",
        style_preset="eza_mirror_professional_v1",
        card_date="2026-05-21",
        quality_hints=QUALITY_HINTS,
    )
    return build_openai_mirror_prompt(req)


async def run_one(topic_key: str) -> dict:
    prompt, negative = build_canon_topic_prompt(topic_key)
    openai_prompt = build_openai_prompt(topic_key)
    result = await generate_mirror_scene(
        prompt=openai_prompt,
        negative_prompt=negative,
        seed_hint=f"mirror-style-lock-qa-{topic_key}",
        style_preset="eza_mirror_professional_v1",
        card_date="2026-05-21",
        quality_hints=QUALITY_HINTS,
    )
    out: dict = {
        "topic": TOPIC_CONFIG[topic_key]["label"],
        "topicKey": topic_key,
        "provider": result.provider,
        "urlKind": "unknown",
        "saved": None,
        "promptLen": len(openai_prompt),
        "rawPromptLen": len(prompt),
    }
    url = result.scene_image_url
    if url.startswith("data:image"):
        out["urlKind"] = "data_url"
        b64 = url.split(",", 1)[-1]
        raw = base64.b64decode(b64)
        path = OUT_DIR / f"{topic_key}.png"
        path.write_bytes(raw)
        out["saved"] = path.name
        out["bytes"] = len(raw)
    elif url.startswith("http"):
        out["urlKind"] = "https"
        out["saved"] = url[:120]
    return out


async def main() -> None:
    os.environ.setdefault("EZA_MIRROR_IMAGE_PROVIDER", "openai")
    get_settings.cache_clear()
    provider_name = resolve_mirror_image_provider_name()
    settings = get_settings()
    if provider_name != "openai":
        print(f"WARN: provider={provider_name} (expected openai)")
    if not (settings.OPENAI_API_KEY or "").strip():
        print("ERROR: OPENAI_API_KEY missing")
        sys.exit(1)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"provider={provider_name} model={settings.EZA_MIRROR_OPENAI_IMAGE_MODEL} size={settings.EZA_MIRROR_IMAGE_SIZE}")
    print(f"output={OUT_DIR}")

    results = []
    for topic_key in TOPIC_CONFIG:
        print(f"generating: {TOPIC_CONFIG[topic_key]['label']} ({topic_key})...")
        try:
            row = await run_one(topic_key)
            results.append(row)
            print(f"  ok provider={row['provider']} file={row.get('saved')} bytes={row.get('bytes', 'n/a')}")
        except Exception as exc:
            results.append(
                {"topic": TOPIC_CONFIG[topic_key]["label"], "topicKey": topic_key, "error": str(exc)[:300]}
            )
            print(f"  FAIL: {type(exc).__name__}: {exc}")

    (OUT_DIR / "summary.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
    prompts_dump = {k: {"prompt": build_canon_topic_prompt(k)[0][:500] + "..."} for k in TOPIC_CONFIG}
    (OUT_DIR / "prompts_preview.json").write_text(json.dumps(prompts_dump, indent=2), encoding="utf-8")

    ok = sum(1 for r in results if "error" not in r and r.get("provider") == "openai")
    print(f"done: {ok}/{len(results)} openai successes")


if __name__ == "__main__":
    asyncio.run(main())
