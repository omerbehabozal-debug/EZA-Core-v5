# EZA Daily Mirror — Dokümantasyon & Roadmap

Mirror ürün ve teknik spec’leri. Uygulama kodu `eza-v5/frontend/lib/eza/mirror/` altında.

**AGENTS.md:** Mirror-critical path’ler ve P4 pipeline sırası için kök `AGENTS.md` dosyasına bakın.

---

## Pipeline (referans)

```
Entries → Intent Lock → Narrative Core → Story Tension → Mirror Moment
       → Scene Archetype → Theme → Identity → Full Canvas Prompt → Scene API
```

Topic/subtopic çözümlemesi görsel prompt aşamasında (`visualPromptEngine`) devreye girer.

---

## Roadmap

| Aşama | Doküman | Durum | Özet |
|-------|---------|-------|------|
| **P4-D** | [P4-D-access-rules-premium-share-artifact.md](./P4-D-access-rules-premium-share-artifact.md) | Spec onaylı | Ephemeral daily mirror, Plus share artifact, Free/Plus gate |
| **P4-F** | — (AGENTS.md) | Devam ediyor | Live scene quality alignment |
| **Sprint 4.3** | `eza-v5/frontend/reports/sprint-4.3-visual-qa/` | Tamamlandı | 162 senaryo Visual QA; Mardin/İspanya/Tonoz gap’leri |
| **P5.1** | **[P5.1-topic-coverage-library.md](./P5.1-topic-coverage-library.md)** | **Tasarım onaylı** | Topic Coverage Library mimarisi, candidate queue, privacy/maliyet |
| **P5.2** | (P5.1 §13) | Planlı | `coverageLibrary` + `coverageResolver` + shard migrate + domain expansion |
| **P5.3** | (P5.1 §13) | Planlı | `coverageLearningQueue`, `/dev/mirror-coverage`, promotion draft |
| **P5.4** | (P5.1 §13) | Planlı (onay) | Anonymized aggregate, LLM classifier (flag off), telemetry |

---

## P5 — Topic Coverage Library (özet)

**Problem:** Yeni konularda Mirror `topic_generic` ve generic headline’a düşüyor.

**Çözüm yönü (P5.1):**

1. Registry-first `coverageLibrary` (~300+ subtopic, ~400+ cue)
2. `coverageSynonyms` — TR/EN, diacritic; üretimde fuzzy yok
3. `coverageResolver` — unified topic + subtopic
4. `coverageLearningQueue` — miss/low-conf candidate (PII-free)
5. İnsan onayı sonrası registry promote; LLM asla otomatik yazmaz

Detay: **[P5.1-topic-coverage-library.md](./P5.1-topic-coverage-library.md)**

---

## Mirror-critical kod yolları

| Path | Rol |
|------|-----|
| `app/standalone/mirror/` | Production daily routes |
| `app/dev/mirror-poster/` | QA fixture (production değil) |
| `lib/eza/mirror/visualPromptEngine.ts` | Scene prompt orchestration |
| `lib/eza/mirror/generateSceneApi.ts` | Scene API client |
| `lib/eza/mirror/dailyMirrorSnapshot.ts` | Ephemeral snapshot |

---

*Son güncelleme: P5.1 topic coverage library tasarım onayı (May 2026).*
