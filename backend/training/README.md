# EZA Training Pipeline (KAPALI)

## 🔒 ALTIN KURALLAR

Bu training pipeline **KAPALI** durumda ve **KESİNLİKLE** kullanılmamalıdır.

### ❌ YAPILMAYACAKLAR

1. **Model eğitimi çalıştırılmayacak**
2. **Fine-tuning yapılmayacak**
3. **RLHF (Reinforcement Learning from Human Feedback) uygulanmayacak**
4. **Threshold'lar otomatik değişmeyecek**
5. **Policy ağırlıkları otomatik güncellenmeyecek**
6. **Rewrite davranışı otomatik değişmeyecek**

### ✅ EĞİTİM HANGİ KOŞULLARDA AÇILIR?

Eğitim pipeline'ının açılması için **TÜM** aşağıdaki koşulların sağlanması gerekir:

1. **Feature Flag:** `LEARNING_PIPELINE_ENABLED=true` (production'da default: false)
2. **Opt-in Gerekliliği:** Organizasyon seviyesinde explicit opt-in
3. **Human-in-the-loop Şartı:** Her eğitim adımı için human approval
4. **Regülasyon Uyum Checklist:**
   - GDPR uyumlu veri anonimleştirme
   - Veri saklama politikası onayı
   - Model audit trail
   - Rollback mekanizması
   - A/B testing framework

### 📋 REGÜLASYON UYUM CHECKLIST

Eğitim açılmadan önce aşağıdaki checklist tamamlanmalıdır:

- [ ] **Veri Anonimleştirme:** Tüm PII kaldırıldı mı?
- [ ] **Veri Saklama:** Retention policy tanımlı mı?
- [ ] **Model Audit Trail:** Her eğitim adımı loglanıyor mu?
- [ ] **Rollback Mekanizması:** Eğitim geri alınabilir mi?
- [ ] **A/B Testing:** Yeni model production'a alınmadan test ediliyor mu?
- [ ] **Human Approval:** Her model update için human approval var mı?
- [ ] **Monitoring:** Model performance real-time izleniyor mu?
- [ ] **Compliance Review:** Legal/Compliance ekibi onayladı mı?

### 🚨 UYARI

Bu pipeline **KESİNLİKLE** production'da aktif olmamalıdır. 
Sadece **explicit opt-in** ve **human approval** ile kullanılabilir.

### 📁 DOSYA YAPISI

```
/training
  /dataset
    schema.json              # Dataset schema definition
    anonymization_rules.json # Anonymization rules
  train.py                   # raise NotImplementedError
  evaluate.py                # raise NotImplementedError
  fine_tune.py               # raise NotImplementedError
  README.md                  # This file
```

### 🔧 KULLANIM

**ŞU ANDA KULLANILMAMALIDIR.**

Tüm fonksiyonlar `NotImplementedError` raise edecektir.

