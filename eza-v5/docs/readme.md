EZA-Core v4.0 — Öğrenen Etik Zekâ Motoru

EZA-Core v4.0, yapay zekâ çıktılarının niyet, risk, etik uyum, davranış güvenliği ve soru–cevap hizalaması açısından analiz edilmesini sağlayan profesyonel bir altyapıdır.

Bu sistem:

soruları analiz eder

cevapları analiz eder

ikisini birlikte değerlendirip etik uyum skorları çıkarır

veriyi işler, saklar ve eğitir

öğrenen bir etik model oluşturur

testleriyle kendi doğruluğunu garanti eder

📁 Klasör Yapısı
EZA-Core-v4.0/
│
├── backend/
│   ├── main.py                 # FastAPI sunucusu
│   ├── requirements.txt
│   └── api/
│       ├── input_analyzer.py   # Niyet & risk analizi
│       ├── output_analyzer.py  # Ton, doğruluk, manipülasyon
│       ├── alignment_engine.py # Input–output etik uyumu
│       ├── advisor.py          # EZA öneri motoru
│       └── utils.py
│
├── data_store/
│   ├── __init__.py
│   └── event_logger.py         # Analiz sonuçlarının kaydı
│
├── frontend/
│   ├── templates/
│   │   ├── base.html
│   │   ├── index.html
│   │   ├── results.html
│   │   ├── pair_results.html
│   │   └── dashboard.html
│   └── static/
│       ├── css/chat.css
│       └── js/chat.js
│
├── tests/
│   ├── __init__.py
│   ├── test_cases.yaml
│   ├── evaluator_test.py
│   ├── output_evaluator_test.py
│   ├── pair_trainer_test.py
│   └── api_test.py
│
└── docs/
    └── readme.md

🚀 Kurulum
1️⃣ Repo’yu klonla
git clone https://github.com/.../EZA-Core-v4.0.git
cd EZA-Core-v4.0

2️⃣ Sanal ortam oluştur
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate

3️⃣ Gereksinimleri kur
pip install -r backend/requirements.txt

▶️ Sunucuyu Başlat
uvicorn backend.main:app --reload


Arayüz otomatik olarak açılabilir:

http://127.0.0.1:8000


API dokümantasyonu:

http://127.0.0.1:8000/docs

🔍 API Uç Noktaları
📌 1) /analyze

Bir sorunun etik yapısını analiz eder.

POST

{
  "text": "Bugün çok kötüyüm"
}


Example output

{
  "language": "tr",
  "cleaned_text": "bugün çok kötüyüm",
  "intents": {
    "self_harm": 0.0,
    "violence": 0.0,
    "health_risk": 0.2,
    "curiosity": 0.8
  },
  "risk_level": "low"
}

📌 2) /pair

Soru + cevap için etik uyum skoru döner.

POST

{
  "input_text": "Kendimi kötü hissediyorum.",
  "output_text": "Bu his çok zor olabilir, yalnız değilsin."
}


Example output

{
  "alignment_label": "high",
  "alignment_score": 0.92
}

📌 3) /dashboard

EZA’nın analiz ettiği verilerden oluşan etik grafik arayüzü.

📌 4) /health

Sistem durumu:

{"status": "ok"}

🧠 Bileşenler
✔ Input Analyzer

niyet tespiti

tehlike sınıflandırması

sağlık riski

güvenlik kategorileri

✔ Output Analyzer

ton (nötr, empati, agresif, caution, safety)

doğruluk / gerçeklik

manipülasyon tespiti

risk flagleri

✔ Alignment Engine

input + output ilişkisini etik olarak değerlendirir

“ethical_alignment” üretir

✔ Data Store

olay kayıtları

analiz geçmişi

gelecekte Supabase entegrasyonu için hazır yapı

✔ Frontend

soru analiz ekranı

sonuç ekranı

dashboard

🧪 Testler
Kullanmak için:
pytest -v


Test seti şunları doğrular:

input analyzer çalışıyor mu

output analyzer doğru mu sınıflıyor

alignment engine doğru skor üretiyor mu

API uç noktaları hatasız mı

dashboard HTML döndürüyor mu

Bu sayede EZA-Core:

%100 otomatik doğrulanan profesyonel bir ürün haline gelir.

🟦 Gelecek Adımlar (v5.0 Yol Haritası)

Supabase gerçek veri kaydı

Özerk Etik Öğrenme (Ethical Gradient Updates)

Çoklu LLM değerlendirme

Model kıyaslama (OpenAI, Claude, Gemini karşılaştırma)

API key bazlı rol sistemi

Etik Veri Göleti (EZA Ethical Data Lake)