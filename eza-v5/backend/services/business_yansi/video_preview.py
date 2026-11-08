"""Authenticated preview of one stored brand video.

The response is a byte range of the object. It is not a public URL, and the
storage key is not copied into the status or the headers.
"""
from backend.services.business_yansi.brand_asset_library import _asset_row
from backend.services.business_yansi.service import access, fail


def parse_byte_range(header: str | None, size: int) -> tuple[int, int]:
    """Return an inclusive byte window. An empty header means the whole object."""
    if size <= 0:
        fail("asset_file_unavailable", 404)
    if header is None or header == "":
        return 0, size - 1
    if not header.startswith("bytes=") or "," in header:
        fail("video_range_rejected", 416)
    spec = header[6:].strip()
    start_text, separator, end_text = spec.partition("-")
    if separator != "-":
        fail("video_range_rejected", 416)
    if start_text == "":
        if not end_text.isdigit() or int(end_text) <= 0:
            fail("video_range_rejected", 416)
        length = int(end_text)
        start = max(0, size - length)
        end = size - 1
    else:
        if not start_text.isdigit():
            fail("video_range_rejected", 416)
        start = int(start_text)
        if end_text == "":
            end = size - 1
        elif end_text.isdigit():
            end = int(end_text)
        else:
            fail("video_range_rejected", 416)
    if start >= size or end < start:
        fail("video_range_rejected", 416)
    return start, min(end, size - 1)


def preview_headers(start: int, end: int, size: int, *, ranged: bool) -> dict[str, str]:
    headers = {
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": 'inline; filename="video.mp4"',
        "Content-Length": str(end - start + 1),
    }
    if ranged:
        headers["Content-Range"] = f"bytes {start}-{end}/{size}"
    return headers


async def preview_video(db, business_id, user_id, asset_id, range_header, store):
    """Read one authorized window. A foreign brand and a missing object fail closed."""
    await access(db, business_id, user_id, "viewer")
    row = await _asset_row(db, business_id, asset_id)
    if row.asset_type != "video" or row.locator_kind != "storage" or not row.locator or "/staging/" in row.locator:
        fail("asset_file_unavailable", 404)
    if row.status == "archived":
        fail("archived_asset", 409)
    if str(row.locator).startswith("http://") or str(row.locator).startswith("https://"):
        fail("asset_file_unavailable", 404)
    stat = await store.head(row.locator)
    if stat is None or stat.size <= 0 or not str(row.locator).endswith(f"/{stat.sha256}.mp4"):
        fail("asset_file_unavailable", 404)
    ranged = bool(range_header)
    start, end = parse_byte_range(range_header, stat.size)
    data = await store.get_range(row.locator, start, end)
    if len(data) != end - start + 1:
        fail("asset_file_unavailable", 404)
    return {
        "body": data,
        "status": 206 if ranged else 200,
        "headers": preview_headers(start, end, stat.size, ranged=ranged),
    }
