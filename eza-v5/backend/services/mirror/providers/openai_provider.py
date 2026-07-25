# -*- coding: utf-8 -*-
"""OpenAI Images API provider for EZA Mirror scene generation."""

from __future__ import annotations

import hashlib
import logging
from typing import Any, Optional

import httpx

from backend.config import get_settings
from backend.core.openai.config import build_openai_request_headers
from backend.core.openai.diagnostic import parse_openai_http_error
from backend.services.mirror.mirror_image_provider import MockMirrorImageProvider, MirrorImageProvider
from backend.services.mirror.mirror_scene_asset_config import is_production_environment
from backend.services.mirror.mirror_scene_asset_store import ensure_persistable_mirror_scene_url
from backend.services.mirror.mirror_image_size import (
    MIRROR_CANONICAL_IMAGE_SIZE,
    MIRROR_OPENAI_ALLOWED_IMAGE_SIZES,
    normalize_mirror_image_size,
)
from backend.services.mirror.openai_prompt_builder import build_openai_mirror_prompt_result
from backend.services.mirror.mirror_scene_prompt_guard import (
    MirrorScenePromptGuardError,
    assert_d2_provider_prompt,
)
from backend.services.mirror.types import MirrorImageProviderError, MirrorImageRequest, MirrorImageResult

logger = logging.getLogger(__name__)

OPENAI_IMAGES_URL = "https://api.openai.com/v1/images/generations"
ALLOWED_IMAGE_SIZES = MIRROR_OPENAI_ALLOWED_IMAGE_SIZES
REQUEST_TIMEOUT_SECONDS = 120.0

_USER_ERROR_MESSAGE = "Mirror sahnesi şu an hazırlanamadı. Daha sonra tekrar deneyebilirsin."


def _seed_log(request: MirrorImageRequest) -> str:
    return (request.seed_hint or "unknown")[:48]


def _normalize_size(size: str) -> str:
    return normalize_mirror_image_size(size)


def _provider_prompt_hash(prompt: str) -> str:
    return hashlib.sha256((prompt or "").encode("utf-8")).hexdigest()


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
        allow_mock_fallback: Optional[bool] = None,
    ) -> None:
        settings = get_settings()
        self._api_key = (api_key if api_key is not None else settings.OPENAI_API_KEY or "").strip()
        self._model = (model or settings.EZA_MIRROR_OPENAI_IMAGE_MODEL or "gpt-image-1").strip()
        self._size = _normalize_size(
            size or settings.EZA_MIRROR_IMAGE_SIZE or MIRROR_CANONICAL_IMAGE_SIZE
        )
        self._http_client = http_client
        if allow_mock_fallback is None:
            # Production: never silent-mock. Dev/test/ci: allow unless explicitly disabled.
            self._allow_mock_fallback = not is_production_environment(settings)
        else:
            self._allow_mock_fallback = allow_mock_fallback

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
        headers = build_openai_request_headers(self._api_key)
        payload = self._build_payload(prompt)
        own_client = self._http_client is None
        client = self._http_client or httpx.AsyncClient(timeout=REQUEST_TIMEOUT_SECONDS)
        try:
            response = await client.post(OPENAI_IMAGES_URL, headers=headers, json=payload)
            if response.status_code >= 400:
                diagnostic = parse_openai_http_error(
                    response.status_code,
                    response.text,
                    dict(response.headers),
                )
                logger.warning(
                    "mirror_openai_images_failed seed=%s status=%s code=%s type=%s request_id=%s",
                    seed,
                    diagnostic.get("httpStatus"),
                    diagnostic.get("errorCode"),
                    diagnostic.get("errorType"),
                    diagnostic.get("requestId"),
                )
                raise MirrorImageProviderError(
                    _USER_ERROR_MESSAGE,
                    source="openai",
                    http_status=int(diagnostic.get("httpStatus") or response.status_code),
                    diagnostic=diagnostic,
                )
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
            if not self._allow_mock_fallback:
                logger.error("mirror_openai_no_api_key seed=%s — refusing mock in production", seed)
                raise MirrorImageProviderError(
                    _USER_ERROR_MESSAGE,
                    source="openai",
                    diagnostic={"errorCode": "openai_api_key_missing"},
                )
            logger.warning("mirror_openai_no_api_key seed=%s — mock fallback (non-prod)", seed)
            return await MockMirrorImageProvider().generate_scene(request)

        built = build_openai_mirror_prompt_result(request)
        prompt = built.prompt
        # Final boundary: hash must match the exact string sent to OpenAI.
        try:
            provider_hash = assert_d2_provider_prompt(
                prompt=prompt,
                generation_id=request.generation_id,
                generation_pipeline=request.generation_pipeline,
                final_scene_prompt_hash=request.final_scene_prompt_hash,
            )
        except MirrorScenePromptGuardError as guard_exc:
            logger.error(
                "mirror_openai_prompt_guard_blocked seed=%s code=%s generationId=%s",
                seed,
                guard_exc.code,
                (request.generation_id or "")[:48],
            )
            raise MirrorImageProviderError(
                guard_exc.message,
                source="prompt_guard",
                diagnostic={"errorCode": guard_exc.code},
            ) from guard_exc
        mapped_hash = _provider_prompt_hash((request.prompt or "").strip())
        logger.info(
            "mirror_openai_generate seed=%s model=%s size=%s prompt_len=%d "
            "providerPromptHash=%s mappedPromptHash=%s hashesEqual=%s "
            "v5=%s truncated=%s contract=%s generationId=%s pipeline=%s",
            seed,
            self._model,
            self._size,
            len(prompt),
            provider_hash,
            mapped_hash,
            provider_hash == mapped_hash,
            built.v5_minimal,
            built.truncated,
            built.contract,
            (request.generation_id or "")[:48],
            request.generation_pipeline or "D2_V5",
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
        persisted_url = ensure_persistable_mirror_scene_url(scene_url)
        if not persisted_url:
            logger.warning("mirror_openai_scene_not_persistable seed=%s", seed)
            raise MirrorImageProviderError(_USER_ERROR_MESSAGE)
        return MirrorImageResult(
            scene_image_url=persisted_url,
            provider="openai",
            cached=False,
        )
