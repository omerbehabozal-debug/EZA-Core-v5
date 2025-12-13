# EZA-Core v4.0 — Teknik Mimari Dokümanı

Bu doküman, EZA-Core v4.0 altyapısının teknik mimarisini, veri akışını,
modüller arası ilişkileri ve güvenlik katmanlarını tanımlar.

EZA-Core; büyük dil modelleri (LLM) ile çalışan sistemlerde,
**etik niyet analizi**, **risk yönetimi** ve **soru–cevap hizalaması**
yapan bir “etik zekâ motorudur”.

---

## 1. Yüksek Seviye Mimari

### 1.1 Bileşenler

- **FastAPI Backend (`backend/main.py`)**
  - API uç noktaları
  - UI render (Jinja2 templates)
  - Middleware katmanı
  - Exception handler’lar

- **Analiz Modülleri (`backend/api/`)**
  - `input_analyzer.py` → kullanıcı girdisi (soru/istek) analizi
  - `output_analyzer.py` → model cevabı analizi
  - `alignment_engine.py` → soru–cevap etik hizalaması
  - `advisor.py` → etik tavsiye ve yeniden yazım önerileri
  - `utils/` → logger, exceptions, normalizer, rate_limit, cache, constants

- **Veri Katmanı (`data_store/`)**
  - `event_logger.py` → analiz sonuçlarını JSON / dosya / DB formatında kaydetmek için ortak arayüz
  - Gelecek sürümlerde Supabase/PostgreSQL ile genişletilebilir

- **Frontend (`frontend/`)**
  - `templates/` → HTML arayüzler (chat, results, pair_results, dashboard)
  - `static/` → CSS + JS + görsel varlıklar

- **Test Katmanı (`tests/`)**
  - `evaluator_test.py` → input analiz testleri
  - `output_evaluator_test.py` → output analiz testleri
  - `pair_trainer_test.py` → alignment engine testleri
  - `api_test.py` → tüm API uç noktalarını test eder
  - `test_cases.yaml` → gri alan senaryoları

- **Dokümantasyon (`docs/`)**
  - `readme.md` → genel kullanım dokümanı (kurulum, API örnekleri)
  - `eza_core_architecture.md` → bu teknik mimari dokümanı

---

## 2. İstek Akışı (Request Flow)

### 2.1 Tek Model Akışı

1. **Kullanıcı isteği (text)** `/analyze` endpoint’ine gelir.
2. `input_analyzer.analyze_input()` çalışır:
   - Metni temizler ve normalize eder
   - Dil tespiti yapar (TR/EN/…)
   - Niyet ve risk skorlarını hesaplar
   - Toplam etik skoru ve risk seviyesini belirler
3. `utils.call_single_model()` seçilen LLM’den (örn. chatgpt) cevap çeker.
4. `output_analyzer.analyze_output()` model cevabını değerlendirir:
   - Ton (tone_score)
   - Doğruluk güveni (fact_score)
   - Empati (empathy_score)
   - Manipülasyon riski (manipulation_score)
5. `alignment_engine.compute_alignment()`:
   - input ve output skorlarını birleştirir
   - 0–1 arası `alignment_score` üretir
   - `alignment_label` (high/safe/normal/low) verir
6. `advisor.generate_advice()`:
   - etik açıdan zayıf noktaları işaretler
   - güvenli ve daha iyi bir cevap için öneri üretir
7. `utils.rewrite_with_ethics()`:
   - model cevabını etik tavsiye ile yeniden yazar (güçlendirilmiş cevap)
8. `data_store.event_logger.log_event()`:
   - analiz sonuçlarını ve yeniden yazılmış cevabı kaydeder
9. Kullanıcıya JSON + (isteğe bağlı) HTML arayüz olarak cevap döner.

### 2.2 Çoklu Model Akışı

- `call_multi_models()` birden fazla modeli paralel çalıştırabilir:
  - Örn: `{"chatgpt": "...", "claude": "...", "gemini": "..."}`
- `output_analyzer.analyze_output()` tüm modellerin cevaplarını analiz edip
  ortalama skorlar üretir.
- Aynı alignment/advisor/rewriter zinciri çalışır.
- Bu sayede “model karşılaştırmalı etik değerlendirme” yapılabilir.

---

## 3. Niyet ve Risk Analizi (Input Analyzer)

### 3.1 Niyet Kategorileri (Örnek)

- **self_harm** → kendine zarar, intihar içerikleri
- **violence** → şiddet, saldırı, bomba, silah
- **health_risk** → ilaç kullanımı, dozaj, yanlış sağlık önerileri
- **financial_risk** → dolandırıcılık, insider trading, pump&dump
- **hate / harassment** → nefret söylemi, hakaret
- **sexual / minors** → hassas cinsel içerik
- **jailbreak / bypass** → model kurallarını delme girişimleri
- **curiosity / normal** → zararsız, bilgi amaçlı istekler

Her kategori için:

- pattern tabanlı kurallar (regex, anahtar kelimeler)
- ağırlıklandırma
- toplam etik skor hesabı

### 3.2 Risk Seviyesi

`overall_ethics` ve niyet skorlarına göre:

- `low` → temel bilgi, neredeyse risksiz
- `medium` → hassas ama yönetilebilir
- `high` → dikkat gerektiren yüksek risk
- `critical` → self-harm, ağır şiddet vb. durumlar

Bu değerler `RISK_THRESHOLDS` sabitleri ile yönetilir.

---

## 4. Çıkış Analizi (Output Analyzer)

### 4.1 Ölçülen Parametreler

- **tone_score** → cevap dilinin yumuşaklık / sertlik seviyesi
- **fact_score** → doğruluk / kanıta dayalı olma seviyesi
- **empathy_score** → insani hassasiyet, anlayış, destek dili
- **manipulation_score** → zorlayıcı / yönlendirici / tehditkar dil riski

### 4.2 Label ve Flag’ler

- `tone_label` → `empathy`, `neutral`, `harsh`, `caution` vb.
- `flags` → `["danger", "health_risk", "self_harm_risk"]` gibi sinyaller

Bu veriler, özellikle yüksek riskli sorularda cevabın
gerçekten “koruyucu ve destekleyici” olup olmadığını anlamak için kullanılır.

---

## 5. Soru–Cevap Etik Hizalaması (Alignment Engine)

`alignment_engine.compute_alignment()` fonksiyonu:

1. Input ve output skorlarından vektör benzerliği (`_vector_similarity`) hesaplar.
2. Output skorlarının ağırlıklı ortalamasını alır:
   - ton, doğruluk, empati (+)
   - manipülasyon (−)
3. Yüksek riskli isteklere verilen cevapların durumuna göre
   ceza/bonus uygular:
   - self-harm / violence içerikli bir istek geldiğinde:
     - cevap empatik + koruyucu ise → alignment yükselir
     - cevap teşvik edici / agresif ise → alignment düşer
4. 0–1 aralığına normalizasyon yapar.
5. Sonuç olarak:
   - `alignment_score` (0–1)
   - `alignment_label` (high / safe / normal / low)

döner.

---

## 6. Güvenlik ve Altyapı Katmanı

### 6.1 Middleware’ler

- **RequestLoggerMiddleware**
  - Her gelen isteği ve dönen yanıtı loglar (JSON formatında).
- **NormalizeMiddleware**
  - POST gövdesini normalize eder (boşluk, newline, unicode temizliği).
- **RateLimitMiddleware**
  - IP bazlı basit rate-limit (örneğin 10 sn’de 5 istek).
- **CircuitBreakerMiddleware**
  - Sürekli hata durumunda API’yi kısa süreliğine “korumaya alır”.

### 6.2 Exception Handler’lar

- `EZAException` → genel EZA hataları
- `RateLimitExceeded` → limit aşımında 429 kodu döndürür
- `generic_exception_handler` → beklenmeyen hatalarda 500 döner ve log yazar

### 6.3 Loglama

- `api/utils/logger.py` → JSON log formatı
- Seviyeler: INFO / WARNING / ERROR
- İleride:
  - ELK Stack (Elasticsearch, Logstash, Kibana)
  - CloudWatch
  - Datadog entegrasyonu yapılabilir

---

## 7. Veri Saklama (Data Store)

### 7.1 Mevcut Durum

- `data_store/event_logger.py` şu anda
  dosya / konsol / ileride DB için ortak bir arayüz sunar.
- JSON log’lar üzerinden:
  - sorgular
  - cevaplar
  - skorlar
  - alignment değerleri
  - yeniden yazılmış etik cevaplar
  kaydedilebilir.

### 7.2 Planlanan DB Şeması (Supabase / PostgreSQL)

İlerleyen sürümlerde aşağıdaki tablolar kullanılacaktır:

- `events` → input analiz kayıtları
- `responses` → model cevap analizleri
- `correlations` → alignment skorları
- `feedbacks` → kullanıcı geri bildirimleri

Bu yapı sayesinde:

- dashboard grafikleri
- uzun dönem trend analizleri
- model karşılaştırmaları
- etik öğrenme mekanizması

kurulmuş olur.

---

## 8. Test ve DevOps

### 8.1 Test Yapısı

- `pytest` kullanılır.
- Örnek komut:
  ```bash
  pytest -v


Kapsam:

input analiz fonksiyonları

output analiz fonksiyonları

alignment engine

API uç noktaları

gri alan senaryoları (test_cases.yaml)

8.2 CI/CD Önerisi

GitHub Actions:

her push’ta:

pip install -r backend/requirements.txt

pytest

Gelecek aşamada:

Docker imajı

staging / production ortamları

otomatik deploy

9. Yol Haritası (v5.0 ve sonrası)

Supabase / PostgreSQL entegrasyonunun tamamlanması

Çoklu model karşılaştırma dashboard’u

Kullanıcı başına etik profil çıkarımı

EZA etik skorlarının harici sistemlere API ile sunulması

“Ethical Data Lake” oluşturarak, modellerin
etik davranışlarını bu verilerle eğitmek

Sertifikasyon modülü: modeller için “Etik Uyum Sertifikası” üretmek

Bu doküman, EZA-Core v4.0’ın teknik mimarisinin resmi referansıdır.