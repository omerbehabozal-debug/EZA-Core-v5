"""Public-safe projection for Yansı V2 publications (image + frozen conversation)."""
from __future__ import annotations

from typing import Any

from backend.services.mirror_network import yansi_v2_contract as pub
from backend.services.yansi import knowledge_bundle as kb


_PRIVATE = frozenset({
    "storageKey", "storage_key", "objectKey", "object_key", "bucket",
    "s3Key", "s3_key", "absolutePath", "absolute_path", "filePath", "file_path",
    "localPath", "local_path", "brandAssetPath", "brand_asset_path",
    "locator", "url", "path", "src", "file", "signedUrl", "signed_url", "content",
})


class PublicProjectionError(ValueError):
    def __init__(self, code: str):
        self.code = code
        super().__init__(code)


def _strip(value: Any) -> Any:
    if isinstance(value, list):
        return [_strip(item) for item in value]
    if isinstance(value, dict):
        return {
            key: _strip(item)
            for key, item in value.items()
            if key not in _PRIVATE
        }
    return value


def _public_bundle_slice(public_bundle: dict[str, Any]) -> dict[str, Any]:
    return {
        "bundleId": public_bundle["bundleId"],
        "bundleVersionId": public_bundle["bundleVersionId"],
        "version": public_bundle["version"],
        "status": public_bundle["status"],
        "bundleHash": public_bundle["bundleHash"],
        "accessScope": public_bundle["accessScope"],
        "items": public_bundle["items"],
    }


def to_public_image_publication_dto(
    *,
    contract: dict[str, Any],
    slug: str,
    bundle_envelope: dict[str, Any],
    asset_id: str,
    business_id: str,
) -> dict[str, Any]:
    """Build the public surface: verified hashes, public media path, no locators."""
    try:
        public_contract = pub.to_public_contract_dto(contract)
    except pub.YansiV2ContractError as exc:
        raise PublicProjectionError(exc.code) from exc

    try:
        public_bundle = kb.to_public_bundle_dto(bundle_envelope)
    except kb.KnowledgeBundleError as exc:
        raise PublicProjectionError(exc.code) from exc

    blocks = public_contract.get("contentManifest", {}).get("blocks") or []
    if len(blocks) != 1 or blocks[0].get("type") != "image":
        raise PublicProjectionError("public_manifest_invalid")
    block = blocks[0]
    if str(block.get("assetId") or "").lower() != str(asset_id).lower():
        raise PublicProjectionError("public_asset_mismatch")
    expected_path = (
        f"/api/business-yansi/public-media/"
        f"{str(business_id).lower()}/{str(asset_id).lower()}"
    )
    if block.get("contentPath") != expected_path:
        raise PublicProjectionError("public_media_path_invalid")

    cleaned = _strip({
        "slug": slug,
        "contract": public_contract,
        "bundle": _public_bundle_slice(public_bundle),
        "media": {
            "assetId": str(asset_id).lower(),
            "contentPath": expected_path,
            "title": block.get("title"),
        },
    })
    pub.assert_no_private_keys(cleaned)
    return cleaned


def to_public_conversation_publication_dto(
    *,
    contract: dict[str, Any],
    slug: str,
    bundle_envelope: dict[str, Any],
    business_id: str | None = None,
) -> dict[str, Any]:
    """Public DTO for frozen 1–8 turn Yansı. First question is curiosityQuestion."""
    try:
        public_contract = pub.to_public_contract_dto(contract)
    except pub.YansiV2ContractError as exc:
        raise PublicProjectionError(exc.code) from exc

    try:
        public_bundle = kb.to_public_bundle_dto(bundle_envelope)
    except kb.KnowledgeBundleError as exc:
        raise PublicProjectionError(exc.code) from exc

    frozen = pub.extract_frozen_conversation_block(
        public_contract.get("contentManifest") or {"blocks": []},
    )
    if frozen is None:
        raise PublicProjectionError("public_manifest_invalid")

    turns = []
    for turn in frozen.turns:
        media_out = []
        for media in turn.media:
            item = media.model_dump(mode="json")
            if media.type == "image":
                if business_id is not None:
                    expected = (
                        f"/api/business-yansi/public-media/"
                        f"{str(business_id).lower()}/{str(media.assetId).lower()}"
                    )
                    if media.contentPath != expected:
                        raise PublicProjectionError("public_media_path_invalid")
                media_out.append({
                    "type": "image",
                    "assetId": media.assetId,
                    "title": media.title,
                    "contentPath": media.contentPath,
                    "assetRevision": media.assetRevision,
                })
            else:
                media_out.append({
                    "type": "video",
                    "assetId": media.assetId,
                    "title": media.title,
                    "href": media.href,
                    "assetRevision": media.assetRevision,
                })
        turns.append({
            "stepIndex": turn.stepIndex,
            "question": turn.question,
            "answer": turn.answer,
            "media": media_out,
        })

    cover = None
    for block in public_contract.get("contentManifest", {}).get("blocks") or []:
        if block.get("type") == "image":
            cover = {
                "assetId": block.get("assetId"),
                "title": block.get("title"),
                "contentPath": block.get("contentPath"),
            }
            break

    cleaned = _strip({
        "slug": slug,
        "contract": public_contract,
        "bundle": _public_bundle_slice(public_bundle),
        "conversation": {
            "turnCount": len(turns),
            "curiosityQuestion": frozen.curiosity_question,
            "turns": turns,
        },
        "cover": cover,
    })
    pub.assert_no_private_keys(cleaned)
    return cleaned
