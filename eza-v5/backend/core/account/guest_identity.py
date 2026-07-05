# -*- coding: utf-8 -*-
"""Resolve guest token to stable fingerprint for quota attribution."""

from backend.services.mirror_network.sohbet_session import guest_token_fingerprint

GUEST_TOKEN_HEADER = "X-Guest-Token"
MIN_GUEST_TOKEN_LENGTH = 16


def resolve_guest_fingerprint(guest_token: str | None) -> str | None:
    """Hash guest token when long enough; ignore invalid/short tokens."""
    token = (guest_token or "").strip()
    if len(token) < MIN_GUEST_TOKEN_LENGTH:
        return None
    return guest_token_fingerprint(token)
