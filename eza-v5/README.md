# EZA-Core V6 — Ethical Zekâ Altyapısı

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

## 🔄 CI/CD Overview

EZA-Core uses GitHub Actions for continuous integration and deployment.

### Workflows

- **`backend-ci.yml`**: Runs backend tests on every push/PR to `main` or `dev` branches
  - Tests all test suites (core, behavioral, policy, security, validation, etc.)
  - Excludes tests marked with `requires_real_llm`
  - Runs in CI mode (minimal logging)

- **`frontend-ci.yml`**: Runs frontend tests and build on every push/PR
  - Lints code
  - Builds Next.js app
  - Runs pre-deployment UI validation tests

- **`nightly-tests.yml`**: Runs full backend test suite every night at 02:00 UTC
  - Comprehensive test coverage
  - Excludes `requires_real_llm` tests (see TODO for separate workflow)

### How It Works

1. **Push/PR Trigger**: When code is pushed or a PR is created:
   - Backend tests run automatically
   - Frontend tests and build run automatically
   - All tests must pass before merge

2. **Nightly Tests**: Every night at 02:00 UTC (05:00 Turkey time):
   - Full backend test suite runs
   - Results are stored as artifacts

3. **Deployment**:
   - **Vercel**: Automatically deploys frontend on merge to `main`
   - **Railway**: Manual deployment from dashboard (or auto-deploy if enabled)
   - See `DEPLOYMENT_README.md` for detailed deployment instructions

### Environment Variables

- `EZA_ENV`: Controls environment behavior
  - `dev`: Detailed logging, debug enabled
  - `ci`: Minimal logging (warnings/errors only), debug disabled
  - `prod`: Production logging, debug disabled

### Test Markers

- `requires_real_llm`: Tests that require actual LLM API calls
  - Currently excluded from CI (TODO: separate workflow with API keys)

For detailed deployment instructions, see [DEPLOYMENT_README.md](../DEPLOYMENT_README.md).

## 📝 Lisans

Proprietary - EZA v5

