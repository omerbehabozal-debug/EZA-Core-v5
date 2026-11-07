"""Valid library PNGs that stay distinct after prepare_brand_library_image."""
from __future__ import annotations

from io import BytesIO

from PIL import Image

# Minimal valid 1x1 RGBA PNG (also used where a shared constant is enough).
LIBRARY_PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01"
    b"\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
    b"\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01"
    b"\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
)


def distinct_library_png(seed: bytes = b"") -> bytes:
    """Return a prepared-unique PNG; trailing-byte tricks no longer differentiate hashes."""
    value = abs(hash(seed)) % (256**3)
    color = ((value >> 16) & 255, (value >> 8) & 255, value & 255)
    buf = BytesIO()
    Image.new("RGB", (8, 8), color=color).save(buf, format="PNG")
    return buf.getvalue()
