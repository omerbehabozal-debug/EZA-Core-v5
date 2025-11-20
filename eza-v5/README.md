# EZA v5 — Ethical Zekâ Altyapısı

Global ölçekte çalışan, üç moddan oluşan (Standalone, Proxy, Proxy-Lite) bir etik karar yönlendirme altyapısı.

## 🎯 Özellikler

- **Standalone Mode**: Son kullanıcı + kurumsal API (Fast Core Pipeline, 100-300ms)
- **Proxy Mode**: EZA AR-GE laboratuvarı (Fast + Deep seçilebilir)
- **Proxy-Lite Mode**: RTÜK / BTK / bankalar gibi kurum denetim paneli
- **Fast Core Pipeline**: Senkron, hızlı analiz
- **Async Deep Learning Pipeline**: Arka planda çalışan derin analiz
- **Full Auth System**: Role-based access control

## 🚀 Kurulum

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Docker

```bash
docker-compose up
```

## 📁 Proje Yapısı

```
eza-v5/
├── backend/
│   ├── main.py
│   ├── routers/        # API endpoints
│   ├── engines/        # Ethical analysis engines
│   ├── learning/      # Learning engine
│   ├── models/        # Database models
│   ├── schemas/       # Pydantic schemas
│   ├── services/      # Business logic
│   ├── utils/         # Utilities
│   └── worker/        # Background tasks
├── frontend/
│   ├── pages/         # Next.js pages
│   ├── components/    # React components
│   └── lib/           # Utilities
└── docs/              # Documentation
```

## 🔐 Roller

- `public_user`: Standalone mode
- `corporate_client`: Standalone + billing
- `institution_auditor`: Proxy-Lite
- `eza_internal`: Proxy
- `admin`: Tüm modlar

## 📚 API Dokümantasyonu

API dokümantasyonu: `http://localhost:8000/docs`

## 🧪 Test

```bash
pytest tests/
```

## 📝 Lisans

Proprietary - EZA v5

