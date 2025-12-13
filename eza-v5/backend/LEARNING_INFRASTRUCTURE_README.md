# EZA Learning Infrastructure (PASİF)

## 🔒 ALTIN KURALLAR

Bu learning altyapısı **PASİF** durumda ve **KESİNLİKLE** mevcut karar mekanizmasına bağlanmamalıdır.

### ❌ YAPILMAYACAKLAR

1. **Mevcut skor hesaplama değiştirilmeyecek**
2. **Policy Engine değiştirilmeyecek**
3. **Pipeline değiştirilmeyecek**
4. **Hiçbir karar learning katmanından beslenmeyecek**
5. **Model eğitimi, fine-tuning, RLHF çalıştırılmayacak**
6. **Threshold, weight, rewrite davranışı otomatik değişmeyecek**

### ✅ YAPILACAKLAR

1. **Tüm learning bileşenleri PASİF / READ-ONLY olacak**
2. **Feature flag ile tamamen kapalı duracak**
3. **Sadece veri toplama ve saklama yapılacak**
4. **Hiçbir inference bu verileri kullanmayacak**

---

## 📋 AŞAMALAR

### AŞAMA 1: Vector DB Entegrasyonu (PASİF) ✅

**Dosyalar:**
- `backend/learning/vector_client.py` - Qdrant client
- `backend/learning/vector_store.py` - Vector store wrapper

**Özellikler:**
- Qdrant client entegrasyonu
- Koleksiyonlar: `ethical_embeddings`, `ethical_cases`
- Feature flag: `VECTOR_DB_ENABLED=false` (default)
- Fail-safe: Flag false ise hiçbir işlem yapılmaz

**Kullanım:**
```python
from backend.learning.vector_client import QdrantClient

client = QdrantClient()  # No-op if VECTOR_DB_ENABLED=false
await client.insert_embedding(...)  # Returns False if disabled
```

---

### AŞAMA 2: Ethical Embedding Persistence (PASİF) ✅

**Dosyalar:**
- `backend/models/ethical_embedding.py` - DB model
- `backend/services/ethical_embedding_service.py` - Service

**Özellikler:**
- Ethical embedding saklama
- Policy skorları (N, F, Z, A) referans için
- Feature flag: `ETHICAL_EMBEDDING_ENABLED=false` (default)
- ❌ Bu embedding hiçbir skoru etkilemeyecek
- ❌ Policy Engine embedding okumayacak

**Kullanım:**
```python
from backend.services.ethical_embedding_service import EthicalEmbeddingService

service = EthicalEmbeddingService()
# No-op if ETHICAL_EMBEDDING_ENABLED=false
result = await service.store_embedding(...)  # Returns None if disabled
```

---

### AŞAMA 3: Case Library Normalizasyonu (PASİF DATASET) ✅

**Dosyalar:**
- `backend/models/ethical_case.py` - DB model
- `backend/services/ethical_case_service.py` - Service

**Özellikler:**
- Cases ve telemetry_events'ten normalized dataset
- Otomatik anonimleştirme (PII removal)
- `is_trainable=false` default
- Feature flag: `LEARNING_PIPELINE_ENABLED=false` (default)
- ❌ Eğitim pipeline'ı burayı kullanmayacak
- ❌ Hiçbir inference bu tabloyu okumayacak

**Kullanım:**
```python
from backend.services.ethical_case_service import EthicalCaseService

service = EthicalCaseService()
# No-op if LEARNING_PIPELINE_ENABLED=false
result = await service.create_ethical_case(...)  # Returns None if disabled
```

---

### AŞAMA 4: Adaptive Policy Telemetry (READ-ONLY) ✅

**Dosyalar:**
- `backend/models/policy_telemetry.py` - DB model
- `backend/services/policy_telemetry_service.py` - Service

**Özellikler:**
- Policy performans metrikleri
- False positive/negative tracking
- Suggested threshold (READ-ONLY - auto-apply yok)
- ❌ Policy ağırlıkları otomatik güncellenmeyecek
- ❌ Threshold'lar otomatik değişmeyecek
- ✅ Sadece dashboard ve raporlamada kullanılacak

**Kullanım:**
```python
from backend.services.policy_telemetry_service import PolicyTelemetryService

service = PolicyTelemetryService()
# Always enabled (read-only, no risk)
await service.record_policy_trigger(db, "N1", was_correct=True)
metrics = await service.get_policy_metrics(db)
```

---

### AŞAMA 5: Training Pipeline Skeleton (KAPALI) ✅

**Dosyalar:**
- `backend/training/train.py` - Raises NotImplementedError
- `backend/training/evaluate.py` - Raises NotImplementedError
- `backend/training/fine_tune.py` - Raises NotImplementedError
- `backend/training/README.md` - Compliance checklist
- `backend/training/dataset/schema.json` - Dataset schema
- `backend/training/dataset/anonymization_rules.json` - Anonymization rules

**Özellikler:**
- Tüm fonksiyonlar `NotImplementedError` raise eder
- Feature flag: `LEARNING_PIPELINE_ENABLED=false` (default)
- Compliance checklist dokümantasyonu

**Kullanım:**
```python
from backend.training.train import train_ethical_model

# Always raises NotImplementedError
train_ethical_model(...)  # Raises NotImplementedError
```

---

### AŞAMA 6: Feature Flags & Güvenlik ✅

**Dosyalar:**
- `backend/config.py` - Feature flags
- `backend/learning/feature_flags.py` - Decorators

**Feature Flags:**
```python
VECTOR_DB_ENABLED = False  # Default: disabled
ETHICAL_EMBEDDING_ENABLED = False  # Default: disabled
LEARNING_PIPELINE_ENABLED = False  # Default: disabled
AUTO_POLICY_UPDATE_ENABLED = False  # Default: disabled (NEVER auto)
```

**Fail-Safe Mekanizmalar:**
- Flag false ise: Kod çalışsa bile no-op
- Log bile basmasın (debug mode hariç)
- Exception raise etmesin

**Kullanım:**
```python
from backend.learning.feature_flags import (
    require_vector_db,
    require_ethical_embedding,
    require_learning_pipeline,
    check_learning_flags
)

@require_vector_db
async def my_function():
    # Only runs if VECTOR_DB_ENABLED=true
    pass

flags = check_learning_flags()  # Check all flags
```

---

### AŞAMA 7: Test & Validasyon ✅

**Dosyalar:**
- `backend/tests/test_learning_feature_flags.py` - Test suite

**Test Kapsamı:**
- ✅ Tüm feature flag'ler default false
- ✅ Vector DB no-op when disabled
- ✅ Ethical Embedding no-op when disabled
- ✅ Ethical Case no-op when disabled
- ✅ Training pipeline raises NotImplementedError
- ✅ Main pipeline unaffected by learning components

**Çalıştırma:**
```bash
pytest backend/tests/test_learning_feature_flags.py -v
```

---

## 🔧 KONFIGÜRASYON

### Environment Variables

```bash
# Vector DB (PASİF)
VECTOR_DB_ENABLED=false
VECTOR_DB_URL=http://localhost:6333
VECTOR_DB_API_KEY=

# Ethical Embedding (PASİF)
ETHICAL_EMBEDDING_ENABLED=false

# Learning Pipeline (KAPALI)
LEARNING_PIPELINE_ENABLED=false

# Auto Policy Update (NEVER)
AUTO_POLICY_UPDATE_ENABLED=false
```

---

## 📊 VERİTABANI MODELLERİ

### Yeni Tablolar

1. **ethical_embeddings**
   - Embedding vektörleri
   - Policy skorları (referans için)
   - Provider/model bilgisi

2. **ethical_cases**
   - Normalized ethical cases
   - Anonimleştirilmiş text
   - `is_trainable=false` default

3. **policy_telemetry**
   - Policy performans metrikleri
   - False positive/negative tracking
   - Suggested threshold (read-only)

### Migration

Alembic migration'ları oluşturulmalı:

```bash
cd eza-v5/backend
alembic revision --autogenerate -m "Add learning infrastructure models"
alembic upgrade head
```

---

## 🚨 UYARILAR

1. **Production'da TÜM flag'ler false olmalı**
2. **Learning bileşenleri hiçbir kararı etkilememeli**
3. **Training pipeline KESİNLİKLE çalıştırılmamalı**
4. **Policy updates otomatik olmamalı**

---

## 📝 SONRAKİ ADIMLAR (İLERİDE)

Learning altyapısının aktif edilmesi için:

1. ✅ Compliance checklist tamamlanmalı
2. ✅ Human approval alınmalı
3. ✅ A/B testing framework kurulmalı
4. ✅ Rollback mekanizması hazır olmalı
5. ✅ Monitoring ve alerting kurulmalı
6. ✅ Legal/Compliance review yapılmalı

**ŞU ANDA HİÇBİR ŞEY AKTİF EDİLMEMELİDİR.**

