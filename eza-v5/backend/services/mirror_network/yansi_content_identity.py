# -*- coding: utf-8 -*-
"""Optional public labels for a personal Yansı.

These fields are not part of publicLandingHash, source_hash, or media_seal.
They do not change safety, sanitization, or moderation decisions.
"""

from __future__ import annotations

from typing import Any, Mapping

EXPERIENCE_TYPES = frozenset({"knowledge", "fun", "story", "discussion", "life"})
CONTENT_NATURES = frozenset({"real", "fiction", "mixed"})


def read_content_identity(frozen: Mapping[str, Any] | None) -> dict[str, str]:
    """Return only stored values that still match the server enum."""
    if not isinstance(frozen, Mapping):
        return {}
    found: dict[str, str] = {}
    experience = frozen.get("experienceType")
    nature = frozen.get("contentNature")
    if experience in EXPERIENCE_TYPES:
        found["experienceType"] = str(experience)
    if nature in CONTENT_NATURES:
        found["contentNature"] = str(nature)
    return found


def stamp_new_freeze(
    freeze: Mapping[str, Any],
    experience_type: str | None,
    content_nature: str | None,
) -> dict[str, Any]:
    """Copy a new freeze and attach requested labels. Does not edit landing or hashes."""
    stamped = dict(freeze)
    if experience_type in EXPERIENCE_TYPES:
        stamped["experienceType"] = experience_type
    if content_nature in CONTENT_NATURES:
        stamped["contentNature"] = content_nature
    return stamped


def public_identity_from_frozen(
    public: Mapping[str, Any],
    frozen: Mapping[str, Any] | None,
) -> dict[str, Any]:
    """Public labels follow the accepted freeze. A losing request cannot leave its own."""
    reconciled = dict(public)
    reconciled.pop("experienceType", None)
    reconciled.pop("contentNature", None)
    reconciled.update(read_content_identity(frozen))
    return reconciled


def identity_for_publish(
    existing_frozen: Mapping[str, Any] | None,
    experience_type: str | None,
    content_nature: str | None,
) -> dict[str, str]:
    """An existing freeze keeps its labels. A new freeze may receive the request."""
    if existing_frozen is not None:
        return read_content_identity(existing_frozen)
    return read_content_identity(
        {
            "experienceType": experience_type,
            "contentNature": content_nature,
        }
    )
