# EZA Global AI Safety OS - Test Framework

## Live Telemetry & Monitor API

### Overview

EZA-Core includes a live telemetry system that records all pipeline executions for real-time monitoring by corporate and regulator panels. Every request to `/api/standalone`, `/api/proxy`, or `/api/proxy-lite` endpoints is automatically logged as a telemetry event.

### What is Telemetry?

Telemetry events capture:
- **User input**: The original user query
- **Pipeline mode**: standalone, proxy, or proxy-lite
- **EZA Score**: The computed safety score (0-100)
- **Risk level**: low, medium, or high
- **Policy violations**: List of detected policy violations
- **Model usage**: Which LLM providers/models were used
- **Metadata**: Alignment scores, deep analysis summaries, safety labels

### Endpoints

#### 1. `/api/monitor/live-feed`
General live feed for monitoring all pipeline events.

**Query Parameters:**
- `limit` (int, default: 50): Maximum number of events to return (1-500)
- `mode` (str, optional): Filter by mode: `standalone`, `proxy`, or `proxy-lite`

**Example:**
```bash
GET /api/monitor/live-feed?limit=100&mode=standalone
```

#### 2. `/api/monitor/corporate-feed`
Corporate panel feed for business monitoring.

**Query Parameters:**
- `limit` (int, default: 50): Maximum number of events
- `mode` (str, optional): Filter by mode

#### 3. `/api/monitor/regulator-feed`
Regulator panel feed (RTÜK, etc.) for compliance monitoring.

**Query Parameters:**
- `limit` (int, default: 100): Maximum number of events

**Filters Applied:**
- Only `standalone` and `proxy` modes (excludes `proxy-lite`)
- Events with policy violations
- High/medium risk events

### How Corporate/Regulator Panels Use These Endpoints

1. **Polling Strategy**: Frontend polls the endpoint every 5-10 seconds
2. **Incremental Updates**: Use `newest_timestamp` to fetch only new events
3. **Real-time Dashboard**: Display events with EZA Score, risk level, and policy violations

### Database Schema

Telemetry events are stored in the `telemetry_events` table with indexed fields for efficient querying.

### Architecture

Pipeline requests → `run_full_pipeline()` → `record_telemetry_event()` (non-blocking) → Database → Monitor API → Corporate/Regulator Panels

### Security (Future)

Currently open for development. In production: authentication, role-based access control, rate limiting.

### Testing

Run telemetry tests:
```bash
pytest backend/tests_monitor/test_monitor_api.py -v
```

---

**7 Katman, 500+ Test Paketi - Full Automation**

## 📊 Test Framework Özeti

| Katman | Test Sayısı | Klasör | Açıklama |
|--------|-------------|--------|----------|
| **1. Core** | 50 | `tests_core/` | Pipeline core component tests |
| **2. Behavioral Extended** | 100 | `tests_behavioral_extended/` | Advanced behavioral safety tests |
| **3. Policy** | 80 | `tests_policy/` | AI Safety Constitution compliance |
| **4. Multi-Turn** | 100 | `tests_multiturn/` | Conversation context tests |
| **5. Adversarial** | 120 | `tests_adversarial/` | Red-team attack tests |
| **6. Multi-Model** | 30 | `tests_multimodel/` | Model consistency tests |
| **7. Performance** | 40 | `tests_performance/` | Load, stress, stability tests |
| **TOPLAM** | **520+** | | |

## 🏗️ Test Yapısı

```
backend/
├── test_tools/                    # Ortak test araçları
│   ├── request_client.py
│   ├── llm_override.py
│   ├── faker_utils.py
│   ├── assert_tools.py
│   └── random_generator.py
│
├── tests_core/                    # KATMAN 1: Core Tests (50)
│   ├── test_input_analyzer.py
│   ├── test_output_analyzer.py
│   ├── test_alignment_engine.py
│   ├── test_score_engine.py
│   └── test_error_handling.py
│
├── tests_behavioral_extended/     # KATMAN 2: Behavioral (100)
│   ├── test_intent_advanced.py
│   ├── test_legal_risk_advanced.py
│   ├── test_deception_advanced.py
│   ├── test_psych_pressure_advanced.py
│   └── test_alignment_robustness.py
│
├── tests_policy/                  # KATMAN 3: Policy (80)
│   ├── test_N_policies.py
│   ├── test_F_policies.py
│   ├── test_Z_policies.py
│   └── test_A_policies.py
│
├── tests_multiturn/               # KATMAN 4: Multi-Turn (100)
│   ├── test_progressive_risk.py
│   ├── test_topic_drift.py
│   ├── test_conversation_manipulation.py
│   └── test_context_graph.py
│
├── tests_adversarial/             # KATMAN 5: Adversarial (120)
│   ├── test_jailbreak.py
│   ├── test_reverse_prompting.py
│   ├── test_obfuscated_keywords.py
│   ├── test_emoji_attack.py
│   ├── test_multilingual_attack.py
│   ├── test_system_prompt_injection.py
│   └── test_mixed_attacks.py
│
├── tests_multimodel/              # KATMAN 6: Multi-Model (30)
│   ├── test_model_consistency.py
│   ├── test_alignment_consistency.py
│   └── test_score_deviation.py
│
└── tests_performance/             # KATMAN 7: Performance (40)
    ├── test_load_100rps.py
    ├── test_burst_1000.py
    ├── test_longrun_stability.py
    ├── test_score_latency.py
    └── test_memory_leak.py
```

## 🚀 Test Komutları

### Tek Katman Çalıştırma

```bash
# Core tests
pytest backend/tests_core -vv

# Behavioral extended
pytest backend/tests_behavioral_extended -vv

# Policy tests
pytest backend/tests_policy -vv

# Multi-turn tests
pytest backend/tests_multiturn -vv

# Adversarial tests
pytest backend/tests_adversarial -vv

# Multi-model tests
pytest backend/tests_multimodel -vv

# Performance tests
pytest backend/tests_performance -vv
```

### Tüm Testleri Çalıştırma

```bash
# Tüm testleri çalıştır (max 1 failure)
pytest backend --maxfail=1 -vv --disable-warnings

# Sadece belirli katmanlar
pytest backend/tests_core backend/tests_policy -vv

# Coverage ile
pytest backend --cov=backend --cov-report=html -vv
```

## 📋 Test Kategorileri Detayı

### Katman 1: Core Tests (50 tests)
- **Input Analyzer**: 10 test
- **Output Analyzer**: 10 test
- **Alignment Engine**: 10 test
- **Score Engine**: 10 test
- **Error Handling**: 10 test

### Katman 2: Behavioral Extended (100 tests)
- **Intent Advanced**: 20 test
- **Legal Risk Advanced**: 20 test
- **Deception Advanced**: 20 test
- **Psych Pressure Advanced**: 20 test
- **Alignment Robustness**: 20 test

### Katman 3: Policy Tests (80 tests)
- **N Policies**: 20 test (N1-N4, 5 each)
- **F Policies**: 15 test (F1-F3, 5 each)
- **Z Policies**: 20 test (Z1-Z4, 5 each)
- **A Policies**: 20 test (A1-A4, 5 each)
- **Policy Score Impact**: 5 test

### Katman 4: Multi-Turn Tests (100 tests)
- **Progressive Risk**: 25 test
- **Manipulation**: 25 test
- **Topic Drift**: 25 test
- **Context Risk Escalation**: 25 test

### Katman 5: Adversarial Tests (120 tests)
- **Jailbreak**: 20 test
- **Reverse Prompting**: 20 test
- **Obfuscated Keywords**: 10 test
- **Emoji Attack**: 10 test
- **Multilingual Attack**: 20 test
- **Prompt Injection**: 20 test
- **Mixed Attacks**: 20 test

### Katman 6: Multi-Model Tests (30 tests)
- **Model Consistency**: 10 test
- **Alignment Consistency**: 10 test
- **Score Deviation**: 10 test

### Katman 7: Performance Tests (40 tests)
- **Load 100 RPS**: 10 test
- **Burst 1000**: 10 test
- **Long-Run Stability**: 10 test
- **Score Latency**: 5 test
- **Memory Leak**: 5 test

## 🛠️ Ortak Test Araçları

### `test_tools/request_client.py`
HTTP client for test requests

### `test_tools/llm_override.py`
Fake LLM implementations for testing

### `test_tools/faker_utils.py`
Fake data generators

### `test_tools/assert_tools.py`
Common assertion utilities

### `test_tools/random_generator.py`
Random test data generators

## 📈 Test Senaryoları

### JSON Senaryo Dosyaları

- `behavior_matrix.json`: 100 behavioral scenarios
- `policy_scenarios_extended.json`: 80 policy scenarios
- `multistep_scenarios.json`: 100 multi-turn scenarios
- `redteam_matrix.json`: 120 adversarial scenarios
- `consistency_matrix.json`: 30 multi-model scenarios

## ✅ Test Özellikleri

- ✅ **Otomatik Senaryo Yükleme**: Tüm testler JSON'dan senaryo yükler
- ✅ **Gerçek LLM Kullanımı**: Behavioral ve adversarial testler gerçek LLM kullanır
- ✅ **Fake LLM Desteği**: Core testler fake LLM ile hızlı çalışır
- ✅ **Comprehensive Coverage**: 520+ test ile kapsamlı kapsam
- ✅ **Performance Testing**: Load, burst, stability testleri
- ✅ **Adversarial Testing**: Red-team attack testleri
- ✅ **Policy Compliance**: AI Safety Constitution testleri

## 🎯 Test Hedefleri

- **Pipeline Core**: Teknik doğruluk
- **Behavioral**: Gerçek dünya davranış
- **Policy**: Anayasa uyumluluğu
- **Multi-Turn**: Context graph doğruluğu
- **Adversarial**: Saldırı direnci
- **Multi-Model**: Model tutarlılığı
- **Performance**: Yük ve stabilite

## 📝 Notlar

⚠️ **Önemli**: 
- Behavioral ve adversarial testler gerçek LLM kullanır (API maliyeti var)
- Performance testleri yüksek kaynak kullanır
- Tüm testler `@pytest.mark.asyncio` ile async
- Testler `@pytest.mark.requires_real_llm` marker'ı kullanır

## 🔧 Konfigürasyon

Test ayarları:
- `tests_behavioral/helpers/llm_settings.py`: LLM konfigürasyonu
- `USE_REAL_LLM = True/False`: Gerçek LLM kullanımı

## 📊 Test İstatistikleri

- **Toplam Test**: 520+
- **Test Dosyası**: 25+
- **JSON Senaryo**: 5+
- **Helper Modül**: 10+
- **Test Kategorisi**: 7 katman
- **Ortak Araç**: 5 modül

## 🎉 Sonuç

EZA artık **GERÇEK BİR GLOBAL AI SAFETY OS** haline geldi:

✅ 520+ test  
✅ 7 katman  
✅ 25+ modül  
✅ Policy doğrulama  
✅ Davranış testi  
✅ Çoklu model testi  
✅ Yük testi  
✅ Context risk testi  
✅ Adversarial red-team testi  

**Tüm testler otomatik, kapsamlı ve production-ready!**

