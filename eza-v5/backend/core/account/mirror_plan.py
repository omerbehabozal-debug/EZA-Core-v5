# -*- coding: utf-8 -*-
"""Legacy mirror_plan storage helpers (free/plus) — no auth deps."""

from typing import Literal

MirrorPlanId = Literal["free", "plus"]


def normalize_mirror_plan(raw: str | None) -> MirrorPlanId:
    return "plus" if raw == "plus" else "free"
