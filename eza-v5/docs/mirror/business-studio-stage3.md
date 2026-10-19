# Business AI Yansı Studio — Stage 3 (Frontend UX)

**Scope:** Business panel AI-assisted studio experience. No production deploy/migration in this stage.

## User flow

1. **Kaynakları gör** — only `published` + `public_allowed` knowledge
2. **AI ile konu öner** — `POST /api/business-yansi/{id}/studio/topics`
3. **Konu seç** — 2–5 cards from real `result.topics` only
4. **Sekiz soruluk sohbet oluştur** — `POST …/studio/generations` (+ poll GET while queued/running)
5. **Önizle** — ChatBubble-based 8-turn preview with evidence passages
6. **Düzenle** — advanced manual form (existing draft contract)
7. **Kaydet / incelemeye gönder** — existing `POST/PATCH /drafts` + `transition` (owner approval untouched)

## Honesty rules

- No invented topics/drafts; empty/blocked API → unavailable banner
- Stage 1 (`blocked` / `studio_execution_not_implemented`) shown as “AI üretim kullanılamıyor”
- Admission off (`503 studio_admission_disabled`) → unavailable
- Duplicate clicks blocked via in-flight guard + idempotency keys
- Publish / Ayna path unchanged

## Files

| Path | Role |
|------|------|
| `frontend/lib/eza/businessStudio.ts` | Typed client + parsers + TR errors |
| `frontend/components/saina/business-studio/BusinessYansiStudio.tsx` | Flow orchestrator |
| `frontend/components/saina/business-studio/StudioChatPreview.tsx` | 8-step chat + evidence |
| `frontend/components/saina/business-studio/StudioGenerationStatus.tsx` | Status chrome |
| `frontend/components/saina/SainaBusinessManager.tsx` | Tab host |
| `frontend/styles/saina-business.css` | Studio styles (scroll architecture preserved) |
| `frontend/tests/businessYansiStudio.test.tsx` | UX + honesty tests |

## Backend dependency

Stage 2 execution backend is **not** on `main` yet. Frontend is wired to Stage 1+2 contracts; full topic/draft success requires Stage 2 merge + flags:

- `BILIGN_STUDIO_ADMISSION_ENABLED=true`
- `BILIGN_STUDIO_EXECUTION_ENABLED=true`
- model/prices configured

Until then the UI remains usable for source selection + manual draft, and shows honest unavailable for AI generation.
