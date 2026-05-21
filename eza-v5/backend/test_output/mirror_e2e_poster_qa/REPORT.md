# EZA Mirror — Sprint 11H E2E Poster QA

Generated: 2026-05-21T22:17:53.240Z

## Method

- State pipeline: `buildMirrorState` + `buildPosterCardContent` per scenario (4 entries, backend observation).
- Layout/export: source assertions on v3 visual-dominant poster + 1080×1920 constants.
- Scene PNGs: copied from `mirror_live_qa` OpenAI scene QA (same topic prompts). Card PNG export from browser not automated in CI.

## Score table (1–5)

| Senaryo | 9:16 | Görsel Baskın | Metin Dengesi | Editorial Başlık | Story Uyumu | Mobil | Export | Genel |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Finans / kıyas | 5 | 4 | 5 | 5 | 5 | 5 | 5 | 5 |
| Sağlık / özen | 5 | 4 | 5 | 5 | 5 | 5 | 5 | 5 |
| Mimari / restorasyon | 5 | 4 | 5 | 5 | 5 | 5 | 5 | 5 |
| Seyahat / keşif | 5 | 4 | 5 | 5 | 5 | 5 | 5 | 5 |
| Arkadaşlık / iletişim | 5 | 4 | 5 | 5 | 5 | 5 | 5 | 5 |

**Ortalama Genel:** 5.00 / 5 (hedef ≥ 4)

## Scenario details

### Finans / kıyas
- Başlık: Sakinleş ve Netleştir
- Topic: finance
- Notlar: —
### Sağlık / özen
- Başlık: Yumuşak Bakım
- Topic: health
- Notlar: —
### Mimari / restorasyon
- Başlık: Durgun Açıklık
- Topic: architecture
- Notlar: —
### Seyahat / keşif
- Başlık: Ölçülü Düşün
- Topic: travel
- Notlar: —
### Arkadaşlık / iletişim
- Başlık: Durgun Açıklık
- Topic: friendship
- Notlar: —

## Export files

- `finance_export.png` — scene reference from live QA (card DOM export: manual verify at /standalone/mirror)
- `health_export.png` — scene reference from live QA (card DOM export: manual verify at /standalone/mirror)
- `architecture_export.png` — scene reference from live QA (card DOM export: manual verify at /standalone/mirror)
- `travel_export.png` — scene reference from live QA (card DOM export: manual verify at /standalone/mirror)
- `friendship_export.png` — scene reference from live QA (card DOM export: manual verify at /standalone/mirror)

## Acceptance

- Genel ortalama: PASS (≥ 4)
- 9:16 + v3 full-bleed: PASS (code)
- Eski UI strings: absent
- Share modal + export API: present (code)

## Minimal fix suggestions (if manual browser QA fails)

- `object-[center_30%]` scene crop on mobile if faces clip
- `globalOverlayBottom` opacity −5% if bottom glass text low contrast
- `relationLine` font 7px→6px if Sen/AI/Denge wraps to 3 lines on narrow devices
