# Phase 8.4 — Publication Visibility & Trust Closure

Yansı'yı yayınladığımda kimlerin görebileceği nettir.
İstersem yayından kaldırabilirim.
Sorunlu bir Yansı'yı bildirebilirim.
Yayından kaldırılan içerik eski linklerden tekrar açılamaz.

## Visibility semantics

| State | Discover | Public profile | Direct link | Frozen / Sohbet | Children (as parent) | Owner rehydrate |
|-------|----------|----------------|-------------|-----------------|----------------------|-----------------|
| `public` + `open` (+ freeze/replay where required) | yes* | yes | yes | yes* | yes* | yes |
| `unlisted` (+ `open`/`review`) | no | no | **yes** (link-accessible) | yes* | yes* | yes |
| `private` (withdrawn / unpublished) | no | no | no | no | no | yes |
| `restricted` (+ typically `private`) | no | no | no | no | no | yes |

\*Subject to existing freeze / replayReady / journey rules from Phase 8.2 (unchanged).

Canonical helpers: `services/mirror_network/visibility_access.py`

## Unlisted policy (declared)

**UNLISTED =** Keşfet’te ve genel public discovery’de görünmez, ama linki olan kişi açabilir.

- Excluded from Discover (already via `public`+`open` SQL)
- Excluded from public profile listing (Phase 8.4 fix)
- Direct `/m/{slug}`, `/frozen`, sohbet remain available when safety_gate passes

## Owner controls

Authenticated owner only (server-side ownership check):

| Action | Endpoint | Effect |
|--------|----------|--------|
| Unpublish / withdraw | `POST /api/mirror-network/{slug}/unpublish` | `visibility=private` |
| Hide from Discover (keep link) | `POST /api/mirror-network/{slug}/visibility` `{visibility:"unlisted"}` | public→unlisted |
| Restore Discover (open only) | same with `{visibility:"public"}` | unlisted→public if `safety_status=open` |

Idempotent unpublish. Does not delete metrics, children, or freeze seals.

## Post-publish safety removal

Internal: `POST /api/mirror-network/{slug}/safety-remove` (`require_internal`)

→ `safety_status=restricted` + `visibility=private`

Public surfaces fail closed. Historical metrics/lineage retained.

## Report flow

Authenticated: `POST /api/mirror-network/{slug}/report` `{reason}`

Reasons: `inappropriate` | `misleading` | `privacy` | `other`

- Duplicate per (slug, reporter) → `already_reported`
- Does **not** auto-hide content
- Does **not** feed Phase 6 metrics or Phase 7 ranking
- Stores only report id, slug, reporter user id, reason, timestamps, status

## Public profile

`GET /api/mirror-network/authors/{user_id}/published` uses `is_profile_listable`  
→ `public` + `open` only (unlisted excluded).

## Child / lineage

- Parent unpublish does not delete children.
- `/children` requires link-accessible parent (`is_children_parent_accessible`).
- Withdrawn/restricted parent → children listing 404; child nodes remain independently if still public.
- Child public DTOs do not embed private parent payload; parent title enrichment fails closed when parent is inaccessible.

## Historical sensitive audit

Read-only script:

`python -m backend.scripts.audit_sensitive_public_yansi_rows`

Counts inconsistent `review+public` / `restricted+public` rows. Does not mutate production.

## Metrics / ranking isolation

Reports, unpublish, and safety-removal do not rewrite Phase 6 experience counts or Phase 7 Strong Curiosity inputs.

## Block user

Deferred — report + owner unpublish + safety removal are the Phase 8.4 minimum trust loop.
