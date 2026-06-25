# -*- coding: utf-8 -*-
"""Safety gate — controls whether a Mirror Network node may be served publicly."""

from __future__ import annotations

from typing import TYPE_CHECKING, Union

from backend.core.schemas.mirror_network import MirrorNetworkSafetyGateResult
from backend.services.mirror_network.types import MirrorNetworkNodeRecord

if TYPE_CHECKING:
    from backend.models.mirror_network import MirrorNetworkNode

MirrorNetworkNodeLike = Union["MirrorNetworkNode", MirrorNetworkNodeRecord]


def evaluate_mirror_network_safety(node: MirrorNetworkNodeLike) -> MirrorNetworkSafetyGateResult:
    visibility = (node.visibility or "public").lower()
    safety_status = (node.safety_status or "open").lower()

    if visibility == "private":
        return MirrorNetworkSafetyGateResult(
            passed=False,
            reason="private_visibility",
            safetyStatus=safety_status,  # type: ignore[arg-type]
            visibility=visibility,  # type: ignore[arg-type]
        )

    if safety_status == "restricted":
        return MirrorNetworkSafetyGateResult(
            passed=False,
            reason="restricted_safety",
            safetyStatus="restricted",
            visibility=visibility,  # type: ignore[arg-type]
        )

    if safety_status == "review" and visibility == "public":
        # Public listing blocked until review completes; unlisted direct link OK in Stage 1 skeleton.
        return MirrorNetworkSafetyGateResult(
            passed=visibility == "unlisted",
            reason=None if visibility == "unlisted" else "pending_review",
            safetyStatus="review",
            visibility=visibility,  # type: ignore[arg-type]
        )

    return MirrorNetworkSafetyGateResult(
        passed=True,
        reason=None,
        safetyStatus=safety_status if safety_status in ("open", "review") else "open",  # type: ignore[arg-type]
        visibility=visibility if visibility in ("public", "unlisted") else "public",  # type: ignore[arg-type]
    )
