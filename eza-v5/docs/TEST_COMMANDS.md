# EZA Test Komutları

## 📍 Çalıştırma Konumu

Tüm test komutları **`eza-v5/backend/`** klasöründen çalıştırılmalıdır:

```powershell
cd eza-v5/backend
```

## 🚀 Test Komutları

### Tek Katman Çalıştırma

```powershell
# Core tests (50 test)
pytest tests_core -vv

# Behavioral extended (100 test)
pytest tests_behavioral_extended -vv

# Policy tests (80 test)
pytest tests_policy -vv

# Multi-turn tests (100 test)
pytest tests_multiturn -vv

# Adversarial tests (120 test)
pytest tests_adversarial -vv

# Multi-model tests (30 test)
pytest tests_multimodel -vv

# Performance tests (40 test)
pytest tests_performance -vv
```

### Tüm Testleri Çalıştırma

```powershell
# Tüm testler (max 1 failure)
pytest --maxfail=1 -vv --disable-warnings

# Sadece fake LLM testleri (hızlı)
pytest -m "not requires_real_llm" -vv

# Sadece gerçek LLM testleri
pytest -m "requires_real_llm" -vv
```

### Proje Kökünden Çalıştırma

Eğer proje kökünden (`EZA-Core-v4.0/`) çalıştırmak isterseniz:

```powershell
# Proje kökünden
pytest eza-v5/backend/tests_core -vv
pytest eza-v5/backend/tests_policy -vv
# ... vs
```

## ⚠️ Önemli Notlar

1. **Çalışma Dizini**: Testler `eza-v5/backend/` klasöründen çalıştırılmalı
2. **Python Path**: `backend/` klasörü Python path'inde olmalı
3. **Gerçek LLM**: Behavioral ve adversarial testler gerçek LLM kullanır (API maliyeti var)
4. **Fake LLM**: Core testler fake LLM kullanır (hızlı ve ücretsiz)

## 🔧 Hızlı Test (Fake LLM)

```powershell
# Sadece core testler (fake LLM, hızlı)
pytest tests_core -vv

# Pipeline testler (fake LLM, hızlı)
pytest tests -vv
```

## 📊 Test Koleksiyonu

```powershell
# Testleri topla ama çalıştırma
pytest --collect-only

# Belirli bir test dosyası
pytest tests_core/test_input_analyzer.py -vv

# Belirli bir test fonksiyonu
pytest tests_core/test_input_analyzer.py::test_input_analyzer_safe_input -vv
```

