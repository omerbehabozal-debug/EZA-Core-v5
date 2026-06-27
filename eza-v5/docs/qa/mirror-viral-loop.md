# SAINA Mirror Viral Loop — E2E QA Checklist

Bu doküman **Mirror → Landing → Guest Sohbet → Branch → Yeni Mirror** viral döngüsünü doğrular.  
Kod değiştirmez; manuel adımlar, fixture kısayolu ve otomatik test referanslarını içerir.

---

## Ön koşullar

| Bileşen | Gereksinim |
|---------|------------|
| Backend | `python backend/run.py` — `http://127.0.0.1:8000` |
| Frontend | `npm run dev` — `http://localhost:3000` |
| DB | `alembic upgrade head` (mirror_network_nodes, conversation_groups) |
| Debug secret | `EZA_DEBUG_SECRET` veya `DEBUG_SECRET` env (fixture seed için) |

```powershell
cd C:\Users\MONSTER\EZA-Core-v4.0\eza-v5\backend
alembic upgrade head
cd ..
$env:EZA_DEBUG_SECRET = "your-local-debug-secret"
python backend/run.py
```

```powershell
cd C:\Users\MONSTER\EZA-Core-v4.0\eza-v5\frontend
npm run dev
```

---

## İki QA yolu

### A — Tam viral loop (ürün yolu)

Adımlar **1–18**: Gerçek kullanıcı Mirror üretir, paylaşır, guest döngüsüne girer.

- Adım **3–4** (Mirror üret + shareUrl): **giriş / Plus** gerekebilir (kendi Mirror’ını kaydetmek).
- Guest kullanıcı (adım 8+) için login **zorunlu değil**.

### B — Fixture kısayolu (hızlı QA)

Adımlar **5–18** için backend’e Kyoto fixture node eklenir; Mirror üretim adımı atlanır.

```powershell
$secret = $env:EZA_DEBUG_SECRET
curl -s -X POST "http://127.0.0.1:8000/api/debug/mirror-network/seed-fixture" `
  -H "X-Debug-Secret: $secret" | ConvertFrom-Json | Select-Object slug, shareUrl, cardTitle
```

Yanıttaki `slug` ile devam edin (ör. `sokak-lambalari-seed01`).

---

## Manuel checklist (18 adım)

Her madde için: `[ ]` işaretle, not al.

### Faz 1 — Sohbet ve Mirror üretimi (Yol A)

| # | Adım | Beklenen | Kontrol |
|---|------|----------|---------|
| 1 | `/standalone` → **Yeni sohbet** | Başlık seçici açılır (“Bu sohbet hangi başlığın altında…”) | `[ ]` |
| 2 | **Yeni başlık: Japonya** → 5–6 mesaj (Kyoto, akşam, kafe, sokak vb.) | Stream çalışır, skorlar gelir | `[ ]` |
| 3 | Mirror panelinden **Mirror oluştur** | Görsel + kart üretilir (login gerekebilir) | `[ ]` |
| 4 | Paylaşım / shareUrl | `https://…/m/{slug}` veya `/m/{slug}` | `[ ]` |

**Negatif:** UI’da “seed”, “branch”, “Araştırmalarım” görünmemeli.

### Faz 2 — Landing (Yol A veya B)

| # | Adım | Beklenen | Kontrol |
|---|------|----------|---------|
| 5 | `shareUrl` veya `/m/{slug}` aç | 200, landing yüklenir | `[ ]` |
| 6 | Landing içeriği | **Yalnızca:** mirror image, `cardTitle`, `curiosityContext`, tarih, CTA | `[ ]` |
| 7 | CTA metni | **“Bu konudan devam et”** → `/m/{slug}/sohbet` | `[ ]` |

**DOM kontrolleri:**

- `[data-mirror-landing]`
- `[data-mirror-landing-slug="{slug}"]`
- Hooks / seedQuestions / coreCuriosity metni **sayfada yok**

```javascript
// DevTools Console — landing leakage sniff
[...document.querySelector('[data-mirror-landing]')?.innerText ?? ''].join(' ')
  .toLowerCase().includes('seed')  // false olmalı
```

### Faz 3 — Guest sohbet

| # | Adım | Beklenen | Kontrol |
|---|------|----------|---------|
| 8 | CTA tıkla | Sohbet açılışı yüklenir (giriş duvarı **yok**) | `[ ]` |
| 9 | Açılış metni | Public payload’dan; raw sohbet / kullanıcı adı **yok** | `[ ]` |
| 10 | Merak kartına tıkla | Textarea doldurulmaz; `/standalone?chat=…&mirrorReply=1` | `[ ]` |
| 11 | Standalone stream | İlk kullanıcı mesajı + assistant yanıtı normal akar | `[ ]` |
| 12 | Sidebar | **Sohbetlerim → Japonya** altında sohbet; **✦** işareti | `[ ]` |

**DOM:**

- `[data-mirror-sohbet]`
- `[data-mirror-thought-card]`
- Sidebar: `[data-testid="saina-conv-group-{groupId}"]`, `✦` başlık önünde

### Faz 4 — Branch önerisi

| # | Adım | Beklenen | Kontrol |
|---|------|----------|---------|
| 13 | 5 dk sessizlik | Assistant bitti, yazmıyorsun, sekme aktif | `[ ]` |
| 14 | Branch bloğu | “Bu merak burada güzel bir yere geldi…” + 2–3 kart | `[ ]` |
| 15 | Kart tıkla | Yeni conversation aynı grupta | `[ ]` |
| 16 | Metadata | `groupId` aynı; `parentConversationId`, `branchFromConversationId`, `startedFromMirrorId`, `rootMirrorId` dolu | `[ ]` |
| 17 | Branch stream | Açılış + otomatik ilk mesaj + assistant yanıtı | `[ ]` |
| 18 | Branch’ten Mirror | Mirror paneli açılır; üretim login isteyebilir (beklenen) | `[ ]` |

**5 dk simülasyon (manuel):**

- Gerçek bekleme, veya
- DevTools → Application → `sessionStorage` / chat archive inceleme sonrası otomatik testlere bakın (aşağıda).

**Branch bloğu DOM:** `[data-testid="mirror-branch-suggestion"]`

### Faz 5 — Regresyon

| Kontrol | Beklenen |
|---------|----------|
| Normal direct sohbet | Grup seçerek yeni sohbet açılır; stream bozulmamış |
| “Araştırmalarım” | Sidebar’da **yok** |
| Private data | `mirrorBody`, `conversationId`, `userId`, `coreCuriosity` UI/network response’ta yok |
| Login duvarı | Guest sohbet + branch için **yok**; Mirror kaydetmede **olabilir** |

### Faz 6 — Guest → Login (conversation tree bind)

| # | Adım | Beklenen | Kontrol |
|---|------|----------|---------|
| 19 | Guest olarak Japonya ağacını oluştur (✦ + branch) | Sidebar: **▾ Japonya** → ✦ + Yerel kafeler | `[ ]` |
| 20 | **Mirror kaydet** veya Plus gate → giriş | Modal: **“Bu merakı kendi hesabına kaydetmek ister misin?”** — “Devam etmek için giriş yap” **yok** | `[ ]` |
| 21 | Giriş yap | Aynı sidebar ağacı korunur; duplicate **Japonya** grubu **yok** | `[ ]` |
| 22 | Sayfayı yenile | Ağaç hâlâ kullanıcıya bağlı; guest flag temiz | `[ ]` |

**API (claim-guest):**

```powershell
curl -s -X POST "http://127.0.0.1:8000/api/conversation-groups/claim-guest" `
  -H "Authorization: Bearer $token" `
  -H "Content-Type: application/json" `
  -d '{"guestToken":"qa-guest-token-abcdefghijklmnop"}' | jq .
```

**Beklenen:** `claimed` dizisi veya `merged` sayısı; private mirror alanları yok.

---

## API doğrulama (curl)

Fixture slug = `$slug` (seed yanıtından).

### Public mirror — leakage yok

```powershell
curl -s "http://127.0.0.1:8000/api/mirror-network/$slug" | jq 'keys'
```

**Olmamalı:** `userId`, `conversationId`, `mirrorBody`, `private_payload`  
**Olabilir (internal):** `slug`, `cardTitle`, `curiosityContext`, `seed` (API; landing UI’da seed gösterilmez)

### Sohbet session — public only

```powershell
curl -s -X POST "http://127.0.0.1:8000/api/mirror-network/$slug/sohbet/session" `
  -H "Content-Type: application/json" `
  -d '{"guestToken":"qa-guest-token-abcdefghijklmnop"}' | jq .
```

**Beklenen:** `openingMessage`, `thoughtCards`, `parentMirrorId`, `rootMirrorId`, `seedTopic`  
**Olmamalı:** `coreCuriosity`, `hooks`, `conversationId`, `mirrorBody`

### Debug audit (opsiyonel)

```powershell
curl -s "http://127.0.0.1:8000/api/debug/mirror-network/$slug" `
  -H "X-Debug-Secret: $secret" | jq '.publicAudit.passed'
```

---

## Otomatik testler (Playwright yok)

Projede Playwright/Cypress **kurulu değil**. Aşağıdaki testler döngünün programatik kısmını doğrular:

| Dosya | Kapsam |
|-------|--------|
| `frontend/tests/mirrorViralLoopQa.test.ts` | Landing surface, guest chat, grup ağacı, branch metadata, leakage |
| `frontend/tests/mergeGuestConversationTree.test.ts` | Guest → login tree bind, dedupe, idempotency |
| `backend/tests/test_mirror_viral_loop_qa.py` | Public API + sohbet session + fixture audit |
| `backend/tests/test_conversation_groups.py` | claim-guest endpoint + title dedupe |

```powershell
cd eza-v5\frontend
npx vitest run tests/mirrorViralLoopQa.test.ts tests/mergeGuestConversationTree.test.ts

cd ..\backend
python -m pytest tests/test_mirror_viral_loop_qa.py tests/test_conversation_groups.py -q
```

---

## Bilinen sınırlar (bu QA dilimi)

1. **Mirror → Network publish:** Tam ürün yolunda UI publish henüz ayrı sprint olabilir; fixture ile landing/guest/branch doğrulanır.
2. **Adım 18:** Mirror üretimi auth gate’li — “login duvarı çıkmıyor” kuralı guest sohbet için geçerli; Mirror kaydı için değil.
3. **5 dk inactivity:** Otomatik testler `BRANCH_SUGGESTION_INACTIVITY_MS` politikasını unit düzeyinde doğrular; manuel QA gerçek 5 dk bekler.

---

## Hızlı PASS kriteri

- [ ] Landing minimal (6 alan)
- [ ] Guest sohbet login’siz
- [ ] Login sonrası Japonya ağacı korunur (duplicate yok)
- [ ] ✦ Japonya grubunda
- [ ] Branch metadata zinciri tam
- [ ] UI’da seed / Araştırmalarım yok
- [ ] `mirrorViralLoopQa` + backend QA testleri yeşil
