# EZA v5 Architecture

## Overview

EZA v5 is a global ethical AI decision routing infrastructure with three operational modes:

1. **Standalone**: Fast, safe responses for end users and corporate APIs
2. **Proxy**: Internal lab for EZA R&D with full analysis
3. **Proxy-Lite**: Audit panel for institutions (RTÜK/BTK/banks)

## System Architecture

### Backend

- **FastAPI**: Web framework
- **PostgreSQL**: Primary database
- **Redis**: Cache and task queue
- **SQLAlchemy**: ORM
- **Celery/RQ**: Background task processing
- **Vector DB**: Pattern storage (Weaviate/Qdrant)

### Frontend

- **Next.js**: React framework
- **TypeScript**: Type safety
- **Tailwind CSS**: Styling

## Pipeline Architecture

### Fast Core Pipeline (Standalone)

1. Input Analyzer (light)
2. Model Router (fast select)
3. Raw Response
4. Output Analyzer (light)
5. Alignment Engine (core)
6. Redirect Engine (core)
7. Score Engine (light)
8. Safe Answer → Return to user

**Target**: 100-300ms response time

### Async Deep Learning Pipeline

Runs in background after Fast Pipeline returns:

1. Deception Engine (deep)
2. Psychological Pressure (deep)
3. Safety Graph (full nodes)
4. Drift Detector (history-aware)
5. Legal Risk (deep)
6. Pattern Extraction (vector ops)
7. Learning Engine Trainer

## Authentication & Authorization

### Roles

- `public_user`: Standalone mode only
- `corporate_client`: Standalone + billing
- `institution_auditor`: Proxy-Lite
- `eza_internal`: Proxy
- `admin`: All modes

### Access Control

- JWT-based authentication
- Role-based access control (RBAC)
- API key support for B2B clients

## Data Flow

1. User request → Authentication
2. Role check → Route to appropriate mode
3. Fast Pipeline → Quick response
4. Async Deep Learning → Background analysis
5. Pattern extraction → Vector DB (no user data)
6. Model training → Continuous improvement

## Security

- Password hashing (bcrypt)
- JWT tokens
- API key authentication
- Role-based access
- No storage of user messages or raw outputs
- Only pattern-level data stored

## Scalability

- Async/await throughout
- Background task processing
- Redis caching
- Vector DB for pattern storage
- Horizontal scaling ready

