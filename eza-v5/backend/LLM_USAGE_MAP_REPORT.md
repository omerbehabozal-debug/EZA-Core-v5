# LLM USAGE MAP - COMPLETE INVENTORY

## 📋 ÖZET

Bu rapor, EZA-Core projesindeki tüm LLM (Large Language Model) çağrılarının tam envanterini içerir.

---

## 🔍 LLM CLIENT ÇAĞRILARI

### Dosya Bazlı Envanter

| Dosya | Fonksiyon | Endpoint | LLM Provider | Max Tokens | Temperature |
|-------|-----------|----------|--------------|------------|-------------|
| `services/proxy_analyzer_stage0.py` | `stage0_fast_risk_scan` | Internal | OpenAI/Groq/Mistral | 300 | 0.2 |
| `services/proxy_analyzer_stage1.py` | `analyze_paragraph_deep` | Internal | OpenAI/Groq/Mistral | 1500 | 0.3 |
| `services/proxy_analyzer_stage2.py` | `rewrite_span` | Internal | OpenAI/Groq/Mistral | 500 | 0.3 |
| `services/proxy_rewrite_engine.py` | `rewrite_content` | Internal | OpenAI/Groq/Mistral | 2000 | 0.3 |
| `routers/proxy_corporate.py` | `proxy_analyze` | `POST /api/proxy/analyze` | OpenAI/Groq/Mistral | N/A (delegated) | N/A |
| `routers/proxy_corporate.py` | `proxy_rewrite` | `POST /api/proxy/rewrite` | OpenAI/Groq/Mistral | N/A (delegated) | N/A |
| `routers/proxy_lite.py` | `analyze_ethical_content` | `POST /api/proxy-lite/analyze` | OpenAI/Groq/Mistral | 1000 | 0.3 |
| `routers/proxy_lite.py` | `rewrite_paragraph` | `POST /api/proxy-lite/rewrite` | OpenAI/Groq/Mistral | 1000 | 0.5 |
| `routers/standalone.py` | `standalone_chat` | `POST /api/standalone_chat` | OpenAI (via route_model) | 180 | 0.2 |
| `routers/proxy.py` | `proxy_eval` | `POST /api/proxy/eval` | OpenAI (via route_model) | 512/1024 | 0.2 |
| `api/streaming.py` | `_get_llm_response` | Internal | OpenAI | 180 | 0.2 |
| `core/engines/model_router.py` | `route_model` | Internal | OpenAI/Groq/Mistral | Variable | 0.2 |
| `gateway/router_adapter.py` | `call_llm_provider` | Internal | OpenAI/Groq/Mistral | Variable | Variable |

---

## ✅ İŞLEMLERDE LLM KULLANIMI

| İşlem | LLM Kullanımı | Açıklama |
|-------|---------------|----------|
| **Metin etik analizi** | ✅ **VAR** | `proxy_analyzer_stage1.py` - `analyze_paragraph_deep()` |
| **Risk skor hesaplama** | ✅ **VAR** | `proxy_analyzer_stage0.py` - `stage0_fast_risk_scan()` |
| **Niyet / bağlam analizi** | ✅ **VAR** | `proxy_analyzer_stage1.py` - `analyze_paragraph_deep()` (content_role, intent) |
| **Paragraf bazlı risk dağılımı** | ✅ **VAR** | `proxy_analyzer_stage1.py` - Her paragraf için ayrı LLM çağrısı |
| **Uzun metin segmentasyonu** | ✅ **VAR** | `proxy_analyzer_stage0.py` - İlk 2000 karakter için LLM çağrısı |
| **Özetleme** | ❌ **YOK** | Özetleme işlemi yok |
| **Rewrite / Suggested text** | ✅ **VAR** | `proxy_rewrite_engine.py`, `proxy_analyzer_stage2.py`, `proxy_lite.py` |

---

## 📊 ENDPOINT BAZLI LLM KULLANIMI

| Endpoint | LLM Var/Yok | Ortalama Token | Risk Seviyesi | Tetikleme | Açıklama |
|----------|-------------|----------------|---------------|-----------|----------|
| `POST /api/proxy/analyze` | ✅ **VAR** | ~2000-5000 | **YÜKSEK** | Buton aksiyonu | Stage-0 (300) + Stage-1 (1500 x N paragraf) |
| `POST /api/proxy/rewrite` | ✅ **VAR** | ~3000-8000 | **YÜKSEK** | Buton aksiyonu | Analiz (2000-5000) + Rewrite (500 x N span) |
| `POST /api/proxy-lite/analyze` | ✅ **VAR** | ~1000 x N | **ORTA** | Buton aksiyonu | Her paragraf için 1000 token |
| `POST /api/proxy-lite/rewrite` | ✅ **VAR** | ~2000-3000 | **ORTA** | Buton aksiyonu | Analiz (1000) + Rewrite (1000) |
| `POST /api/standalone_chat` | ✅ **VAR** | ~180 | **DÜŞÜK** | Otomatik | Her mesaj için tek LLM çağrısı |
| `POST /api/proxy/eval` | ✅ **VAR** | ~512-1024 | **ORTA** | Buton aksiyonu | Fast: 512, Deep: 1024 |

---

## 🔄 CHUNKING / SEGMENTASYON

### Uzun Metin İşleme

| Dosya | Fonksiyon | Chunking Yapılıyor mu? | Max Chunk Size | Açıklama |
|-------|-----------|------------------------|----------------|----------|
| `services/proxy_analyzer.py` | `split_into_paragraphs` | ✅ **EVET** | 2000 karakter | Paragraflara böler |
| `services/proxy_analyzer_stage0.py` | `stage0_fast_risk_scan` | ✅ **EVET** | 2000 karakter | İlk 2000 karakteri analiz eder |
| `services/proxy_analyzer_stage1.py` | `stage1_targeted_deep_analysis` | ✅ **EVET** | Paragraf bazlı | Her paragraf için ayrı LLM çağrısı |
| `routers/proxy_lite.py` | `split_into_paragraphs` | ✅ **EVET** | 1000 karakter | Paragraflara böler |

**Önemli:** Metin uzunluğu arttıkça LLM çağrı sayısı artıyor. Özellikle:
- **Proxy Analyze:** Her paragraf için 1 LLM çağrısı (Stage-1)
- **Proxy-Lite Analyze:** Her paragraf için 1 LLM çağrısı
- **Proxy Rewrite:** Her riskli span için 1 LLM çağrısı (max 5 span)

---

## 🎯 TETİKLEME MEKANİZMALARI

### Otomatik Tetikleme

| Endpoint | Otomatik mı? | Açıklama |
|----------|--------------|----------|
| `POST /api/standalone_chat` | ✅ **EVET** | Her kullanıcı mesajı otomatik olarak LLM çağrısı tetikler |
| `POST /api/proxy/analyze` | ❌ **HAYIR** | Sadece buton aksiyonu ile tetiklenir |
| `POST /api/proxy/rewrite` | ❌ **HAYIR** | Sadece buton aksiyonu ile tetiklenir |
| `POST /api/proxy-lite/analyze` | ❌ **HAYIR** | Sadece buton aksiyonu ile tetiklenir |
| `POST /api/proxy-lite/rewrite` | ❌ **HAYIR** | Sadece buton aksiyonu ile tetiklenir |

---

## 💰 TOKEN TÜKETİMİ ANALİZİ

### Ortalama Token Tüketimi (Tahmini)

| İşlem | Input Tokens | Output Tokens | Toplam | Açıklama |
|-------|--------------|---------------|--------|----------|
| **Stage-0 Fast Scan** | ~500-1000 | ~300 | ~800-1300 | Hızlı risk taraması |
| **Stage-1 Deep Analysis (1 paragraf)** | ~500-1500 | ~1500 | ~2000-3000 | Derin analiz |
| **Stage-2 Rewrite (1 span)** | ~200-500 | ~500 | ~700-1000 | Span bazlı rewrite |
| **Proxy-Lite Analyze (1 paragraf)** | ~300-800 | ~1000 | ~1300-1800 | Paragraf analizi |
| **Proxy-Lite Rewrite** | ~500-1000 | ~1000 | ~1500-2000 | Yeniden yazım |
| **Standalone Chat** | ~50-200 | ~180 | ~230-380 | Basit sohbet |

### Metin Uzunluğu vs Çağrı Sayısı

| Metin Uzunluğu | Paragraf Sayısı | LLM Çağrı Sayısı (Proxy Analyze) | Toplam Token (Tahmini) |
|----------------|-----------------|-----------------------------------|------------------------|
| 500 karakter | 1 | 2 (Stage-0 + Stage-1) | ~2800-4300 |
| 2000 karakter | 2-3 | 3-4 (Stage-0 + 2-3 Stage-1) | ~4800-7300 |
| 5000 karakter | 5-7 | 6-8 (Stage-0 + 5-7 Stage-1) | ~10800-16300 |
| 10000 karakter | 10-15 | 11-16 (Stage-0 + 10-15 Stage-1) | ~20800-31300 |

**Not:** PRO mode'da `analyze_all_paragraphs=True` olduğu için tüm paragraflar analiz edilir.

---

## 🔀 ANALİZ vs REWRITE ENDPOINT'LERİ ARASINDAKİ AYRIM

| Özellik | Analyze Endpoint | Rewrite Endpoint |
|---------|------------------|------------------|
| **LLM Kullanımı** | ✅ Stage-0 + Stage-1 | ✅ Stage-0 + Stage-1 + Stage-2 |
| **Token Tüketimi** | Orta-Yüksek | Yüksek |
| **Çağrı Sayısı** | 1-15 (paragraf sayısına göre) | 1-15 (analiz) + 1-5 (rewrite) |
| **Tetikleme** | Buton aksiyonu | Buton aksiyonu |
| **Bağımlılık** | Bağımsız | Analyze sonucuna bağımlı |

**Önemli:** Rewrite endpoint'i önce analiz yapar, sonra rewrite yapar. Bu nedenle token tüketimi daha yüksektir.

---

## 📈 RİSK SEVİYESİ (MALİYET AÇISINDAN)

| Endpoint | Risk Seviyesi | Neden | Öneri |
|----------|---------------|-------|-------|
| `POST /api/proxy/analyze` | 🔴 **YÜKSEK** | Paragraf sayısına göre artan çağrı sayısı | Rate limiting, caching |
| `POST /api/proxy/rewrite` | 🔴 **YÜKSEK** | Analiz + Rewrite kombinasyonu | Rate limiting, span limiti (max 5) |
| `POST /api/proxy-lite/analyze` | 🟡 **ORTA** | Paragraf bazlı ama daha az token | Rate limiting |
| `POST /api/proxy-lite/rewrite` | 🟡 **ORTA** | 2 LLM çağrısı (analiz + rewrite) | Rate limiting |
| `POST /api/standalone_chat` | 🟢 **DÜŞÜK** | Tek çağrı, düşük token | Rate limiting (5 req/3s) |

---

## 🛡️ MEVCUT OPTİMİZASYONLAR

1. **Caching:** Stage-0 sonuçları semantic cache'de saklanıyor (org_id bazlı)
2. **Rate Limiting:** Her endpoint için rate limiting var
3. **Circuit Breaker:** Proxy analyze için circuit breaker mekanizması
4. **Span Limiti:** Rewrite için max 5 span limiti
5. **Paragraf Limiti:** Stage-1 için max 4 paragraf (FAST mode), tüm paragraflar (PRO mode)

---

## 📝 SONUÇ

- **Toplam LLM Client Dosyası:** 3 (OpenAI, Groq, Mistral)
- **Toplam LLM Çağrı Noktası:** ~15 fonksiyon
- **En Yüksek Token Tüketimi:** Proxy Rewrite (3000-8000 token)
- **En Düşük Token Tüketimi:** Standalone Chat (230-380 token)
- **Chunking:** ✅ Evet, paragraf bazlı
- **Otomatik Tetikleme:** Sadece Standalone Chat
- **Buton Aksiyonu:** Proxy ve Proxy-Lite endpoint'leri

---

**Rapor Tarihi:** 2025-01-01  
**Versiyon:** 1.0

