# -*- coding: utf-8 -*-
"""OpenAI Images API provider for EZA Mirror scene generation."""

from __future__ import annotations

import logging
from typing import Any, Optional

import httpx

from backend.config import get_settings
from backend.services.mirror.mirror_image_provider import MockMirrorImageProvider, MirrorImageProvider
from backend.services.mirror.openai_prompt_builder import build_openai_mirror_prompt
from backend.services.mirror.types import MirrorImageProviderError, MirrorImageRequest, MirrorImageResult

logger = logging.getLogger(__name__)

OPENAI_IMAGES_URL = "https://api.openai.com/v1/images/generations"
ALLOWED_IMAGE_SIZES = frozenset({"1024x1024", "1024x1536", "1536x1024", "auto"})
REQUEST_TIMEOUT_SECONDS = 120.0

_USER_ERROR_MESSAGE = "Mirror sahnesi şu an hazırlanamadı. Daha sonra tekrar deneyebilirsin."


def _seed_log(request: MirrorImageRequest) -> str:
    return (request.seed_hint or "unknown")[:48]


def _normalize_size(size: str) -> str:
    s = (size or "").strip()
    return s if s in ALLOWED_IMAGE_SIZES else "1024x1536"


def _scene_url_from_openai_item(item: dict[str, Any]) -> str:
    b64 = item.get("b64_json")
    if b64:
        return f"data:image/png;base64,{b64}"
    url = item.get("url")
    if url and isinstance(url, str):
        return url.strip()
    raise MirrorImageProviderError(_USER_ERROR_MESSAGE)


class OpenAIMirrorImageProvider(MirrorImageProvider):
    """Generates textless mirror scenes via OpenAI Images API (backend-only)."""

    def __init__(
        self,
        *,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        size: Optional[str] = None,
        http_client: Optional[httpx.AsyncClient] = None,
    ) -> None:
        settings = get_settings()
        self._api_key = (api_key if api_key is not None else settings.OPENAI_API_KEY or "").strip()
        self._model = (model or settings.EZA_MIRROR_OPENAI_IMAGE_MODEL or "gpt-image-1").strip()
        self._size = _normalize_size(size or settings.EZA_MIRROR_IMAGE_SIZE or "1024x1536")
        self._http_client = http_client

    def _build_payload(self, prompt: str) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "model": self._model,
            "prompt": prompt,
            "size": self._size,
            "n": 1,
        }
        # Prefer inline base64 for frontend/export without CDN (DALL·E family).
        if self._model.startswith("dall-e"):
            payload["response_format"] = "b64_json"
        return payload

    async def _post_images(self, prompt: str, *, seed: str) -> dict[str, Any]:
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }
        payload = self._build_payload(prompt)
        own_client = self._http_client is None
        client = self._http_client or httpx.AsyncClient(timeout=REQUEST_TIMEOUT_SECONDS)
        try:
            response = await client.post(OPENAI_IMAGES_URL, headers=headers, json=payload)
            if response.status_code >= 400:
                logger.warning(
                    "mirror_openai_images_failed seed=%s status=%s",
                    seed,
                    response.status_code,
                )
                raise MirrorImageProviderError(_USER_ERROR_MESSAGE)
            return response.json()
        except httpx.HTTPError as exc:
            logger.warning(
                "mirror_openai_http_error seed=%s err=%s",
                seed,
                type(exc).__name__,
            )
            raise MirrorImageProviderError(_USER_ERROR_MESSAGE) from exc
        finally:
            if own_client:
                await client.aclose()

    async def generate_scene(self, request: MirrorImageRequest) -> MirrorImageResult:
        seed = _seed_log(request)
        if not self._api_key:
            logger.warning("mirror_openai_no_api_key seed=%s — mock fallback", seed)
            return await MockMirrorImageProvider().generate_scene(request)

        prompt = build_openai_mirror_prompt(request)
        logger.info(
            "mirror_openai_generate seed=%s model=%s size=%s prompt_len=%d",
            seed,
            self._model,
            self._size,
            len(prompt),
        )

        try:
            body = await self._post_images(prompt, seed=seed)
        except MirrorImageProviderError:
            raise
        except Exception as exc:
            logger.warning("mirror_openai_unexpected seed=%s err=%s", seed, type(exc).__name__)
            raise MirrorImageProviderError(_USER_ERROR_MESSAGE) from exc

        data = body.get("data") or []
        if not data:
            logger.warning("mirror_openai_empty_data seed=%s", seed)
            raise MirrorImageProviderError(_USER_ERROR_MESSAGE)

        scene_url = _scene_url_from_openai_item(data[0])
        return MirrorImageResult(
            scene_image_url=scene_url,
            provider="openai",
            cached=False,
        )
