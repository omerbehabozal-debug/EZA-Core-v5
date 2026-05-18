"""Convert generated PNG companions to production WebP names."""

from pathlib import Path

from PIL import Image

ASSETS = Path(r"C:\Users\MONSTER\.cursor\projects\c-Users-MONSTER-EZA-Core-v4-0\assets")
OUT = Path(__file__).resolve().parents[1] / "public" / "personas"

PAIRS = [
    ("deep_thinking_gen.png", "deep_thinking.webp"),
    ("ideation_creation_gen.png", "ideation_creation.webp"),
    ("fast_practical_gen.png", "fast_practical.webp"),
    ("planning_structure_gen.png", "planning_structure.webp"),
    ("trust_verification_gen.png", "trust_verification.webp"),
]


def to_square_webp(src: Path, dest: Path, size: int = 512) -> None:
    im = Image.open(src).convert("RGBA")
    w, h = im.size
    side = max(w, h)
    canvas = Image.new("RGBA", (side, side), (255, 255, 255, 0))
    canvas.paste(im, ((side - w) // 2, (side - h) // 2))
    canvas = canvas.resize((size, size), Image.Resampling.LANCZOS)
    canvas.save(dest, "WEBP", quality=88, method=6)
    print(dest)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for src_name, dest_name in PAIRS:
        to_square_webp(ASSETS / src_name, OUT / dest_name)

    for extra in OUT.glob("*_thumb.webp"):
        extra.unlink()
    for extra in OUT.glob("*_ref.webp"):
        extra.unlink()
    for extra in OUT.glob("*_alt.webp"):
        extra.unlink()

    required = [
        "curiosity_exploration.webp",
        "decision_direction.webp",
        "clarity_simplification.webp",
        "ideation_creation.webp",
        "deep_thinking.webp",
        "sensitive_careful.webp",
        "fast_practical.webp",
        "planning_structure.webp",
        "trust_verification.webp",
        "balanced_calm.webp",
    ]
    missing = [n for n in required if not (OUT / n).exists()]
    if missing:
        raise SystemExit(f"Missing assets: {missing}")
    print("All 10 production assets present.")


if __name__ == "__main__":
    main()
