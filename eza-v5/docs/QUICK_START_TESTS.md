# EZA Test Framework - Hızlı Başlangıç

## ⚡ Hızlı Test (Fake LLM - Ücretsiz)

```powershell
# 1. Backend klasörüne git
cd eza-v5/backend

# 2. Core testleri çalıştır (50 test, fake LLM, hızlı)
pytest tests_core -vv

# 3. Pipeline testleri çalıştır (fake LLM, hızlı)
pytest tests -vv
```

## 🎯 Tüm Test Katmanları

```powershell
# Backend klasöründen çalıştır
cd eza-v5/backend

# Katman 1: Core (50 test)
pytest tests_core -vv

# Katman 2: Behavioral Extended (100 test - gerçek LLM)
pytest tests_behavioral_extended -vv

# Katman 3: Policy (80 test)
pytest tests_policy -vv

# Katman 4: Multi-Turn (100 test - gerçek LLM)
pytest tests_multiturn -vv

# Katman 5: Adversarial (120 test - gerçek LLM)
pytest tests_adversarial -vv

# Katman 6: Multi-Model (30 test - gerçek LLM)
pytest tests_multimodel -vv

# Katman 7: Performance (40 test)
pytest tests_performance -vv
```

## 🔥 Tüm Testleri Çalıştır

```powershell
cd eza-v5/backend
pytest --maxfail=1 -vv --disable-warnings
```

## ⚠️ Önemli

- **Çalışma Dizini**: `eza-v5/backend/` klasöründen çalıştırın
- **Gerçek LLM Testleri**: Behavioral, adversarial, multi-model testler gerçek LLM kullanır (API maliyeti var)
- **Fake LLM Testleri**: Core ve pipeline testler fake LLM kullanır (hızlı ve ücretsiz)

## 📝 Proje Kökünden Çalıştırma

Eğer proje kökünden (`EZA-Core-v4.0/`) çalıştırmak isterseniz:

```powershell
pytest eza-v5/backend/tests_core -vv
```

## ✅ Test Durumu

- ✅ **50 Core Tests**: Çalışıyor
- ✅ **100 Behavioral Extended**: Hazır (gerçek LLM gerekli)
- ✅ **80 Policy Tests**: Hazır
- ✅ **100 Multi-Turn Tests**: Hazır (gerçek LLM gerekli)
- ✅ **120 Adversarial Tests**: Hazır (gerçek LLM gerekli)
- ✅ **30 Multi-Model Tests**: Hazır (gerçek LLM gerekli)
- ✅ **40 Performance Tests**: Hazır

**Toplam: 520+ Test Hazır!**

