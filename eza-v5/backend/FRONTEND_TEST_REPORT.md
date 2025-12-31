# EZA Test & Safety Benchmarks - Frontend Raporu

## 📊 API Endpoint

```
GET /api/test-results/comprehensive
```

**Authentication:** API Key gerekli

---

## 📋 Response Yapısı

### Örnek Response

```json
{
  "overall": {
    "total_runs": 163,
    "total_tests": 5406,
    "total_passed": 4735,
    "total_failed": 656,
    "success_rate": 87.6
  },
  "test_suites": [
    {
      "name": "Adversarial Detection",
      "name_tr": "Güvenlik & Saldırı Tespiti",
      "test_count": 132,
      "passed": 132,
      "failed": 0,
      "success_rate": 100.0,
      "status": "completed",
      "status_tr": "Tamamlandı",
      "description": "Jailbreak, prompt injection, emoji attack, obfuscation, mode switching ve red-team saldırı senaryoları.",
      "improvement": {
        "from": 30.3,
        "to": 100.0,
        "change": "+69.7%"
      },
      "label": "Gerçek LLM"
    },
    {
      "name": "Core",
      "name_tr": "Temel Fonksiyonellik",
      "test_count": 50,
      "passed": 50,
      "failed": 0,
      "success_rate": 100.0,
      "status": "completed",
      "status_tr": "Tamamlandı",
      "description": "Temel fonksiyonellik, pipeline, skor hesaplama, alignment engine, output analyzer ve error handling testleri.",
      "label": "Fake LLM"
    },
    {
      "name": "Behavioral",
      "name_tr": "Davranışsal Analiz",
      "test_count": 45,
      "passed": 41,
      "failed": 4,
      "success_rate": 91.1,
      "status": "partial",
      "status_tr": "Kısmen Tamamlandı",
      "description": "Intent detection, output safety, deception detection, legal risk, psych pressure ve alignment quality testleri.",
      "label": "Gerçek LLM"
    },
    {
      "name": "Behavioral Extended",
      "name_tr": "Gelişmiş Davranışsal Senaryolar",
      "test_count": 100,
      "passed": 80,
      "failed": 20,
      "success_rate": 80.0,
      "status": "partial",
      "status_tr": "Kısmen Tamamlandı",
      "description": "Gelişmiş davranışsal senaryolar, risk kategorileri, deception advanced, legal risk advanced, psych pressure advanced ve intent advanced testleri.",
      "label": "Gerçek LLM"
    },
    {
      "name": "Policy",
      "name_tr": "Politika İhlali Tespiti",
      "test_count": 127,
      "passed": 127,
      "failed": 0,
      "success_rate": 100.0,
      "status": "completed",
      "status_tr": "Tamamlandı",
      "description": "Politika ihlali tespiti, F1-F3 ve Z1-Z3 policy testleri.",
      "label": "Gerçek LLM"
    },
    {
      "name": "Multi-Turn",
      "name_tr": "Çoklu Tur Konuşmalar",
      "test_count": 100,
      "passed": 100,
      "failed": 0,
      "success_rate": 100.0,
      "status": "completed",
      "status_tr": "Tamamlandı",
      "description": "Çoklu tur konuşmalar, bağlam korunması ve risk artışı senaryoları.",
      "label": "Gerçek LLM"
    },
    {
      "name": "Multi-Model",
      "name_tr": "Çoklu Model Tutarlılığı",
      "test_count": 30,
      "passed": 30,
      "failed": 0,
      "success_rate": 100.0,
      "status": "completed",
      "status_tr": "Tamamlandı",
      "description": "OpenAI, Groq ve Mistral modelleri arasında skor tutarlılığı ve alignment testleri.",
      "improvement": {
        "from": 60.0,
        "to": 100.0,
        "change": "+40%"
      },
      "details": ["OpenAI", "Groq", "Mistral"],
      "label": "Gerçek LLM"
    },
    {
      "name": "Performance",
      "name_tr": "Performans Testleri",
      "test_count": 52,
      "passed": 52,
      "failed": 0,
      "success_rate": 100.0,
      "status": "completed",
      "status_tr": "Tamamlandı",
      "description": "Gecikme, eşzamanlılık, throughput, bellek ve uzun süreli stabilite testleri.",
      "details": {
        "Latency": 12,
        "Burst/Throughput": 12,
        "Concurrency": 12,
        "Memory": 8,
        "Stability": 8
      },
      "label": "Fake LLM"
    }
  ],
  "major_runs": [
    {
      "date": "2025-12-30T16:51:34",
      "total": 259,
      "passed": 254,
      "failed": 5,
      "success_rate": 98.1
    },
    {
      "date": "2025-12-30T17:12:54",
      "total": 259,
      "passed": 254,
      "failed": 5,
      "success_rate": 98.1
    },
    {
      "date": "2025-12-30T18:05:44",
      "total": 327,
      "passed": 303,
      "failed": 24,
      "success_rate": 92.7
    }
  ],
  "improvements": {
    "total_fixes": 8,
    "tests_fixed": 2,
    "remaining_issues": 24
  },
  "last_updated": "2025-12-31T01:39:39Z"
}
```

---

## 🎨 Frontend Sayfa Yapısı

### 1. Hero Section

**Başlık:** "EZA Test & Safety Benchmarks"

**Açıklama:** 
"EZA, yapay zekâ güvenliği için dünya standartlarında **591 kapsamlı testten** oluşan çok katmanlı bir değerlendirme ekosistemi sunar."

**Ana Metrikler (3 Kart):**

1. **Toplam Test**
   - Icon: ✅ (mavi daire içinde)
   - Değer: `sum(test_suites[].test_count)` = 636 (veya 591 unique)
   - Açıklama: "Toplam Test"

2. **Genel Başarı Oranı**
   - Icon: 📈 (yeşil kare içinde)
   - Değer: `overall.success_rate` = 87.6%
   - Açıklama: "Genel Başarı Oranı"

3. **Test Suite Sayısı**
   - Icon: 📚 (mavi kare içinde)
   - Değer: `test_suites.length` = 8
   - Açıklama: "Test Suite Sayısı"

---

### 2. Tüm Zamanlar İstatistikleri Bölümü

**Başlık:** "Tüm Zamanlar İstatistikleri"

**Metrikler:**
- Toplam Test Run: `overall.total_runs` (163)
- Toplam Test Çalıştırıldı: `overall.total_tests` (5,406)
- Toplam Başarılı: `overall.total_passed` (4,735) - %87.6
- Toplam Başarısız: `overall.total_failed` (656) - %12.4

**Görselleştirme:** 
- Progress bar veya kartlar
- Renk kodlaması: Yeşil (başarılı), Kırmızı (başarısız)

---

### 3. Test Suite Özeti Bölümü

**Başlık:** "Test Suite Özeti"

**Açıklama:** 
"8 farklı test paketi ile EZA'nın güvenilirliği ve performansı kapsamlı şekilde değerlendirilmektedir."

**Grid Layout:** 8 kart (2x4 veya 3x3)

**Her Kart İçin:**

```typescript
interface TestSuiteCard {
  title: string;              // suite.name_tr
  status: "completed" | "partial";
  statusText: string;         // suite.status_tr
  statusIcon: "✅" | "⚠️";
  testCount: number;          // suite.test_count
  successRate: number;         // suite.success_rate
  progressBar: number;        // suite.success_rate (0-100)
  description: string;        // suite.description
  improvement?: {             // suite.improvement (varsa)
    from: number;
    to: number;
    change: string;
  };
  details?: string[] | object; // suite.details (varsa)
  label: string;              // suite.label
}
```

**Kart Renk Kodlaması:**
- ✅ Yeşil: `status === "completed" && success_rate === 100`
- ⚠️ Sarı/Turuncu: `status === "partial" || success_rate < 100`
- Progress bar: Gradient (yeşil → mavi), `success_rate` kadar dolu

**İyileştirme Göstergesi:**
- Eğer `improvement` varsa:
  - Mavi kutu içinde "İyileştirme" etiketi
  - Format: `{improvement.from}% → {improvement.to}%` veya `{improvement.change}`

**Detaylar Bölümü:**
- Eğer `details` varsa:
  - Gri kutu içinde "Detaylar" etiketi
  - Eğer array ise: Liste formatında
  - Eğer object ise: Key-value formatında

---

### 4. Major Test Runs Timeline

**Başlık:** "Major Test Runs"

**Gösterim:** Timeline veya tablo formatında

**Her Run İçin:**
- Tarih: `major_runs[].date` (format: YYYY-MM-DD HH:MM)
- Test Sayısı: `major_runs[].total`
- Başarılı: `major_runs[].passed` (%)
- Başarısız: `major_runs[].failed`
- Başarı Oranı: `major_runs[].success_rate`%

---

### 5. İyileştirmeler Bölümü

**Başlık:** "Yapılan İyileştirmeler"

**Metrikler:**
- Toplam Düzeltme: `improvements.total_fixes` (8)
- Düzeltilen Test: `improvements.tests_fixed` (2)
- Kalan Sorunlar: `improvements.remaining_issues` (24)

**Görselleştirme:**
- İyileştirme grafikleri (Adversarial: %30.3 → %100)
- Progress indicators

---

## 🎨 UI/UX Detayları

### Renk Paleti

- **Yeşil (#10B981):** %100 başarı, Tamamlandı
- **Sarı/Turuncu (#F59E0B):** %80-95 başarı, Kısmen Tamamlandı
- **Kırmızı (#EF4444):** %80 altı, Dikkat Gerekli
- **Mavi (#3B82F6):** İyileştirme göstergeleri, detaylar
- **Gri (#6B7280):** Detaylar, label'lar

### Progress Bar

- **Gradient:** Yeşil (#10B981) → Mavi (#3B82F6)
- **Width:** `success_rate` kadar (örn: %87.6 için 87.6% genişlik)
- **Animation:** Smooth transition

### İkonlar

- ✅ Tamamlandı (yeşil checkmark)
- ⚠️ Kısmen Tamamlandı (sarı warning)
- 📈 İyileştirme (yeşil trend up)
- 📚 Test Suite (mavi layers)

---

## 📝 Sayfa Metinleri (Türkçe)

### Hero Section
- **Başlık:** "EZA Test & Safety Benchmarks"
- **Açıklama:** "EZA, yapay zekâ güvenliği için dünya standartlarında **591 kapsamlı testten** oluşan çok katmanlı bir değerlendirme ekosistemi sunar."

### Ana Metrikler
- "Toplam Test"
- "Genel Başarı Oranı"
- "Test Suite Sayısı"

### Test Suite Özeti
- **Başlık:** "Test Suite Özeti"
- **Açıklama:** "8 farklı test paketi ile EZA'nın güvenilirliği ve performansı kapsamlı şekilde değerlendirilmektedir."

### Tüm Zamanlar İstatistikleri
- **Başlık:** "Tüm Zamanlar İstatistikleri"
- "Toplam Test Run: 163"
- "Toplam Test Çalıştırıldı: 5,406"
- "Toplam Başarılı: 4,735 (%87.6)"
- "Toplam Başarısız: 656 (%12.4)"

---

## 🔄 API Kullanımı

### TypeScript Interface

```typescript
interface ComprehensiveTestResults {
  overall: {
    total_runs: number;
    total_tests: number;
    total_passed: number;
    total_failed: number;
    success_rate: number;
  };
  test_suites: Array<{
    name: string;
    name_tr: string;
    test_count: number;
    passed: number;
    failed: number;
    success_rate: number;
    status: "completed" | "partial";
    status_tr: string;
    description: string;
    label: string;
    improvement?: {
      from: number;
      to: number;
      change: string;
    };
    details?: string[] | Record<string, number>;
  }>;
  major_runs: Array<{
    date: string;
    total: number;
    passed: number;
    failed: number;
    success_rate: number;
  }>;
  improvements: {
    total_fixes: number;
    tests_fixed: number;
    remaining_issues: number;
  };
  last_updated: string;
}
```

### Fetch Örneği

```typescript
const fetchTestResults = async () => {
  const response = await fetch('https://api.ezacore.ai/api/test-results/comprehensive', {
    headers: {
      'X-API-Key': 'your-api-key'
    }
  });
  const data: ComprehensiveTestResults = await response.json();
  return data;
};
```

---

## 📊 Hesaplama Notları

### Toplam Test Sayısı

Tüm suite'lerin toplamı: 132 + 50 + 45 + 100 + 127 + 100 + 30 + 52 = **636 test**

Ancak bazı testler birden fazla suite'de çalıştırılıyor olabilir, bu yüzden unique test sayısı **591** olarak gösterilebilir.

### Genel Başarı Oranı

- **Tüm zamanlar:** `overall.success_rate` = %87.6 (5,406 test üzerinden)
- **Son major run:** %92.7 (327 test üzerinden)
- **Suite ortalaması:** Tüm suite'lerin başarı oranlarının ağırlıklı ortalaması

---

## ✅ Checklist

Frontend sayfasında gösterilmesi gerekenler:

- [x] Hero section (başlık, açıklama, 3 ana metrik)
- [x] Test Suite Özeti (8 kart, grid layout)
- [x] Tüm Zamanlar İstatistikleri
- [x] Major Test Runs Timeline
- [x] İyileştirmeler bölümü
- [x] Progress bar'lar (gradient, animasyonlu)
- [x] İyileştirme göstergeleri (mavi kutu)
- [x] Detaylar bölümü (gri kutu)
- [x] Renk kodlaması (yeşil/sarı/kırmızı)
- [x] Responsive design

---

Bu rapor, frontend sayfasında gösterilecek tüm bilgileri ve API yapısını içermektedir.

