"""
Extract soft-premium companion renders from approved EZA mockup PNGs.
Outputs square WebP assets to public/personas/.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ASSETS = Path(
    r"C:\Users\MONSTER\.cursor\projects\c-Users-MONSTER-EZA-Core-v4-0\assets"
)
OUT = Path(__file__).resolve().parents[1] / "public" / "personas"

MOCKUP_PENGUIN = ASSETS / (
    "c__Users_MONSTER_AppData_Roaming_Cursor_User_workspaceStorage_9a9dfe7877d5f682b98f80ba70803015_images_"
    "ChatGPT_Image_18_May_2026_18_21_43-d33b1ce4-11e8-4197-b1b0-c0b8f27e4a9c.png"
)
MOCKUP_HEDGEHOG = ASSETS / (
    "c__Users_MONSTER_AppData_Roaming_Cursor_User_workspaceStorage_9a9dfe7877d5f682b98f80ba70803015_images_"
    "ChatGPT_Image_18_May_2026_18_21_27-720e8504-160b-4cd5-a4af-8596d4392d87.png"
)
MOCKUP_DEER = ASSETS / (
    "c__Users_MONSTER_AppData_Roaming_Cursor_User_workspaceStorage_9a9dfe7877d5f682b98f80ba70803015_images_"
    "ChatGPT_Image_18_May_2026_18_21_48-c4032383-02da-4708-be5e-b054d2684961.png"
)


def crop_square(im: Image.Image, box: tuple[int, int, int, int], size: int = 512) -> Image.Image:
    region = im.crop(box).convert("RGBA")
    w, h = region.size
    side = max(w, h)
    canvas = Image.new("RGBA", (side, side), (255, 255, 255, 0))
    canvas.paste(region, ((side - w) // 2, (side - h) // 2))
    return canvas.resize((size, size), Image.Resampling.LANCZOS)


def save_webp(img: Image.Image, name: str) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / f"{name}.webp"
    img.save(path, "WEBP", quality=88, method=6)
    print(f"wrote {path}")


def extract_bottom_row(im: Image.Image, indices: dict[int, str]) -> None:
    """Bottom companion preview row — 5 equal columns."""
    w, h = im.size
    y0 = int(h * 0.79)
    y1 = int(h * 0.97)
    col_w = w // 5
    for idx, name in indices.items():
        x0 = idx * col_w
        x1 = (idx + 1) * col_w if idx < 4 else w
        save_webp(crop_square(im, (x0, y0, x1, y1)), name)


def main() -> None:
    penguin_img = Image.open(MOCKUP_PENGUIN)
    hedgehog_img = Image.open(MOCKUP_HEDGEHOG)
    deer_img = Image.open(MOCKUP_DEER)

    # Hero card companions (higher quality than bottom row)
    save_webp(
        crop_square(penguin_img, (300, 175, 470, 395)),
        "decision_direction",
    )
    save_webp(
        crop_square(hedgehog_img, (295, 175, 465, 395)),
        "deep_thinking",
    )
    save_webp(
        crop_square(deer_img, (300, 175, 470, 395)),
        "sensitive_careful",
    )

    # Bottom preview row: hedgehog, owl, fox, dolphin, panda (mockup 1)
    extract_bottom_row(
        hedgehog_img,
        {
            0: "deep_thinking_alt",
            1: "clarity_simplification",
            2: "curiosity_exploration",
            3: "deep_thinking_whale_ref",
            4: "balanced_calm",
        },
    )

    # Bottom row mockup 2: penguin, owl, fox, dolphin, panda
    extract_bottom_row(
        penguin_img,
        {
            0: "decision_direction_thumb",
            1: "clarity_simplification_thumb",
            2: "curiosity_exploration_thumb",
            3: "ideation_creation_ref",
            4: "balanced_calm_thumb",
        },
    )

    print("Done — review *_thumb / *_ref files; production names set for hero crops.")


if __name__ == "__main__":
    main()
