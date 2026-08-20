# -*- coding: utf-8 -*-
"""Phase 8.4 — canonical Yansı public visibility / access helpers.

Product contract (declared):

PUBLIC (+ open + frozen/replay rules where applicable)
  → Discover (if Discover eligibility passes)
  → public profile listing
  → direct link
  → frozen / sohbet / children (when otherwise ready)

UNLISTED
  → NOT Discover
  → NOT public profile listing
  → direct link MAY work (link-accessible) when safety_gate passes
  → frozen / sohbet may work when otherwise ready

PRIVATE / unpublished (withdrawn)
  → owner rehydrate only
  → no public surfaces

RESTRICTED safety
  → unavailable publicly (all public surfaces fail)
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Literal, Union

from backend.services.mirror_network.safety_gate import evaluate_mirror_network_safety
from backend.services.mirror_network.types import MirrorNetworkNodeRecord

if TYPE_CHECKING:
    from backend.models.mirror_network import MirrorNetworkNode

MirrorNetworkNodeLike = Union["MirrorNetworkNode", MirrorNetworkNodeRecord]

PublicAccessKind = Literal[
    "discover_listing",
    "profile_listing",
    "direct_link",
    "frozen_replay",
    "sohbet",
    "children_parent",
]


def _visibility(node: MirrorNetworkNodeLike) -> str:
    return (getattr(node, "visibility", None) or "public").strip().lower()


def _safety(node: MirrorNetworkNodeLike) -> str:
    return (getattr(node, "safety_status", None) or "open").strip().lower()


def is_direct_link_accessible(node: MirrorNetworkNodeLike) -> bool:
    """
    Known-slug / share-link access including intentional UNLISTED.
    Private and restricted fail. Unlisted+review passes (Phase 8.2/8.4 policy).
    """
    return bool(evaluate_mirror_network_safety(node).passed)


def is_profile_listable(node: MirrorNetworkNodeLike) -> bool:
    """
    Public profile listing — Discover-aligned public discovery surface.
    Unlisted is link-only and must NOT appear here.
    """
    if _visibility(node) != "public":
        return False
    if _safety(node) != "open":
        return False
    return is_direct_link_accessible(node)


def is_discover_visibility_eligible(node: MirrorNetworkNodeLike) -> bool:
    """Visibility/safety axis only (Discover also requires freeze/replay/root)."""
    return is_profile_listable(node)


def is_children_parent_accessible(node: MirrorNetworkNodeLike) -> bool:
    """
    Parent gate for /children — link-accessible parent (public or unlisted).
    Withdrawn/private/restricted parents do not expose children listings.
    """
    return is_direct_link_accessible(node)


def public_access_allowed(node: MirrorNetworkNodeLike, kind: PublicAccessKind) -> bool:
    if kind == "discover_listing" or kind == "profile_listing":
        return is_profile_listable(node)
    if kind in ("direct_link", "frozen_replay", "sohbet", "children_parent"):
        return is_direct_link_accessible(node)
    return False
