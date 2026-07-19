# -*- coding: utf-8 -*-
"""Mirror Director rollout mode + execution policy (PR C).

Modes: LEGACY | SHADOW | SOFT | FULL

Config priority:
1. EZA_MIRROR_DIRECTOR_MODE (if set and valid)
2. EZA_MIRROR_DIRECTOR_ENABLED boolean compatibility
   true → FULL, false → LEGACY
3. Default → LEGACY

Runtime note:
  Mode is resolved per request from process environment / Settings.
  `get_settings()` is process-cached (lru_cache). Changing MODE or ENABLED
  on the host typically requires a process restart or redeploy for Settings
  values to apply; do not assume live hot-reload across all deployment models.
  Prefer setting EZA_MIRROR_DIRECTOR_MODE in the platform env and restarting
  the API workers after changes.

Future percentage rollout should sit ABOVE this resolver as a separate layer
(account allowlist + hash bucket + emergency override) — not inside this enum.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Literal

from backend.config import get_settings

MirrorDirectorMode = Literal["LEGACY", "SHADOW", "SOFT", "FULL"]

VALID_MODES: frozenset[str] = frozenset({"LEGACY", "SHADOW", "SOFT", "FULL"})


@dataclass(frozen=True)
class MirrorDirectorExecutionPolicy:
    mode: MirrorDirectorMode
    run_meaning_analysis: bool
    run_draft: bool
    run_review: bool
    use_director_title: bool
    use_director_prompt: bool
    persist_director_metadata: bool
    affect_user_output: bool

    @property
    def run_director_pipeline(self) -> bool:
        return self.run_meaning_analysis or self.run_draft or self.run_review


_POLICIES: dict[MirrorDirectorMode, MirrorDirectorExecutionPolicy] = {
    "LEGACY": MirrorDirectorExecutionPolicy(
        mode="LEGACY",
        run_meaning_analysis=False,
        run_draft=False,
        run_review=False,
        use_director_title=False,
        use_director_prompt=False,
        persist_director_metadata=False,
        affect_user_output=False,
    ),
    "SHADOW": MirrorDirectorExecutionPolicy(
        mode="SHADOW",
        run_meaning_analysis=True,
        run_draft=True,
        run_review=True,
        use_director_title=False,
        use_director_prompt=False,
        persist_director_metadata=True,
        affect_user_output=False,
    ),
    "SOFT": MirrorDirectorExecutionPolicy(
        mode="SOFT",
        run_meaning_analysis=True,
        run_draft=True,
        run_review=True,
        use_director_title=True,
        use_director_prompt=False,
        persist_director_metadata=True,
        affect_user_output=True,
    ),
    "FULL": MirrorDirectorExecutionPolicy(
        mode="FULL",
        run_meaning_analysis=True,
        run_draft=True,
        run_review=True,
        use_director_title=True,
        use_director_prompt=True,
        persist_director_metadata=True,
        affect_user_output=True,
    ),
}


def _truthy(raw: str | None) -> bool | None:
    if raw is None:
        return None
    value = raw.strip().lower()
    if value in {"1", "true", "yes", "on"}:
        return True
    if value in {"0", "false", "no", "off", ""}:
        return False
    return None


def resolve_mirror_director_mode() -> MirrorDirectorMode:
    """Backend authority for Director rollout mode. Invalid → LEGACY."""
    mode_env = (os.getenv("EZA_MIRROR_DIRECTOR_MODE") or "").strip().upper()
    if mode_env:
        if mode_env in VALID_MODES:
            return mode_env  # type: ignore[return-value]
        return "LEGACY"

    settings = get_settings()
    settings_mode = str(getattr(settings, "EZA_MIRROR_DIRECTOR_MODE", "") or "").strip().upper()
    if settings_mode:
        if settings_mode in VALID_MODES:
            return settings_mode  # type: ignore[return-value]
        return "LEGACY"

    enabled_env = _truthy(os.getenv("EZA_MIRROR_DIRECTOR_ENABLED"))
    if enabled_env is True:
        return "FULL"
    if enabled_env is False:
        return "LEGACY"

    if bool(getattr(settings, "EZA_MIRROR_DIRECTOR_ENABLED", False)):
        return "FULL"
    return "LEGACY"


def get_mirror_director_execution_policy(
    mode: MirrorDirectorMode | None = None,
) -> MirrorDirectorExecutionPolicy:
    resolved = mode or resolve_mirror_director_mode()
    return _POLICIES[resolved]


def is_mirror_director_pipeline_enabled() -> bool:
    """Backward-compatible: True when mode is not LEGACY (pipeline may run)."""
    return resolve_mirror_director_mode() != "LEGACY"
