# EZA-Core Deployment Guide

## Overview

This guide covers deployment of EZA-Core backend and frontend to production environments.

**Architecture:**
- **Backend (FastAPI)** → Railway / Render
- **Frontend (Next.js)** → Vercel
- **Environments:**
  - **Dev**: localhost
  - **Staging**: (optional)
  - **Prod**: `*.ezacore.ai` domains

---

## 1. General Architecture

```
┌─────────────────┐
│   Vercel        │  Frontend (Next.js)
│   *.ezacore.ai  │  - standalone.ezacore.ai
│                 │  - proxy.ezacore.ai
│                 │  - corporate.ezacore.ai
│                 │  - regulator.ezacore.ai
└────────┬────────┘
         │ HTTPS/WSS
         │
┌────────▼────────┐
│   Railway      │  Backend (FastAPI)
│   api.ezacore.ai│  - REST API
│                │  - WebSocket
└────────────────┘
```

---

## 2. Backend Deployment

### 2.1 Railway Deployment

#### Step 1: Create Railway Account
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub account
3. Create new project

#### Step 2: Deploy from GitHub
1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Select repository: `EZA-Core-v4.0`
4. Select branch: `main`

#### Step 3: Configure Service
1. **Root Directory**: `eza-v5/backend`
2. **Start Command**:
   ```bash
   uvicorn backend.main:app --host 0.0.0.0 --port $PORT
   ```
3. **Port**: Railway automatically sets `$PORT` environment variable

#### Step 4: Environment Variables
Add the following environment variables in Railway dashboard:

```bash
# Environment
EZA_ENV=prod

# Security
EZA_JWT_SECRET=<generate-strong-secret-here>
EZA_ADMIN_API_KEY=<generate-admin-api-key-here>

# Redis (for rate limiting)
EZA_REDIS_URL=redis://default:<password>@<host>:<port>
# Or use Railway Redis addon

# Database (if using external DB)
DATABASE_URL=postgresql+asyncpg://user:password@host:port/dbname

# LLM API Keys
OPENAI_API_KEY=<your-openai-key>
GROQ_API_KEY=<your-groq-key>
MISTRAL_API_KEY=<your-mistral-key>
ANTHROPIC_API_KEY=<your-anthropic-key>

# Optional
REDIS_URL=redis://default:<password>@<host>:<port>
```

**Generate Secrets:**
```python
# Generate JWT secret
import secrets
print(secrets.token_urlsafe(32))

# Generate API key
print(f"eza_{secrets.token_urlsafe(32)}")
```

#### Step 5: Health Check
Railway automatically checks `/health` endpoint. Ensure it's configured in your FastAPI app.

#### Step 6: Custom Domain
1. Go to Settings → Domains
2. Add custom domain: `api.ezacore.ai`
3. Configure DNS records as instructed by Railway

#### Step 7: Logs & Metrics
- **Logs**: Available in Railway dashboard → Deployments → Logs
- **Metrics**: Railway provides basic metrics (CPU, Memory, Network)

---

### 2.2 Render Deployment (Alternative)

#### Step 1: Create Render Account
1. Go to [render.com](https://render.com)
2. Sign up with GitHub account

#### Step 2: Create Web Service
1. Click "New" → "Web Service"
2. Connect GitHub repository: `EZA-Core-v4.0`
3. Select branch: `main`

#### Step 3: Configure Service
- **Name**: `eza-backend`
- **Root Directory**: `eza-v5/backend`
- **Environment**: Python 3
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`

#### Step 4: Environment Variables
Same as Railway (see above)

#### Step 5: Custom Domain
1. Go to Settings → Custom Domains
2. Add domain: `api.ezacore.ai`
3. Configure DNS

---

## 3. Frontend Deployment (Vercel)

### Step 1: Create Vercel Account
1. Go to [vercel.com](https://vercel.com)
2. Sign up with GitHub account

### Step 2: Import Project
1. Click "Add New" → "Project"
2. Import Git Repository: `EZA-Core-v4.0` (or `EZA-Core-v5` if different)
3. Select repository and branch: `main` (or `eza-global` if that's your production branch)

### Step 3: Configure Project
- **Framework Preset**: Next.js (auto-detected)
- **Root Directory**: 
  - If frontend is at root level: Leave empty or set to `/`
  - If frontend is in `eza-v5/frontend`: Set to `eza-v5/frontend`
  - If frontend is in `frontend`: Set to `frontend`
  - **⚠️ IMPORTANT**: Check your repository structure first!
- **Build Command**: `npm run build` (default)
- **Install Command**: `npm ci` (default)
- **Output Directory**: `.next` (default)

**How to find the correct Root Directory:**
1. Check your repository structure on GitHub
2. Look for `package.json` file - that's your frontend root
3. Common locations:
   - `frontend/` (if at root level)
   - `eza-v5/frontend/` (if nested)
   - `/` (if frontend files are at repository root)

### Step 4: Environment Variables
Add in Vercel dashboard → Settings → Environment Variables:

```bash
# Production
NEXT_PUBLIC_EZA_API_URL=https://api.ezacore.ai
NEXT_PUBLIC_EZA_WS_URL=wss://api.ezacore.ai

# Preview (for PR previews)
NEXT_PUBLIC_EZA_API_URL=https://api-staging.ezacore.ai
NEXT_PUBLIC_EZA_WS_URL=wss://api-staging.ezacore.ai
```

### Step 5: Domain Configuration
Vercel supports multiple domains per project. Configure each domain:

1. **Go to**: Settings → Domains
2. **Add domains**:
   - `standalone.ezacore.ai`
   - `proxy.ezacore.ai`
   - `corporate.ezacore.ai`
   - `regulator.ezacore.ai`
   - `platform.ezacore.ai`
   - `admin.ezacore.ai`

3. **DNS Configuration**:
   - Add CNAME records pointing to Vercel (instructions provided by Vercel)
   - Example: `standalone.ezacore.ai` → `cname.vercel-dns.com`

### Step 6: Domain Routing
The frontend already has middleware (`middleware.ts`) that handles domain-based routing:
- `standalone.ezacore.ai` → `/standalone`
- `proxy.ezacore.ai` → `/proxy`
- `corporate.ezacore.ai` → `/corporate`
- `regulator.ezacore.ai` → `/regulator`

No additional Vercel configuration needed for routing.

### Step 7: Automatic Deployments
- **Production**: Every push to `main` branch automatically deploys
- **Preview**: Every PR gets a preview deployment URL
- **Rollback**: Available in Vercel dashboard → Deployments

---

## 4. CI → Deploy Flow

### Recommended Workflow

1. **Development**:
   - Create feature branch
   - Make changes
   - Push to GitHub

2. **CI Pipeline** (GitHub Actions):
   - Backend tests run automatically
   - Frontend tests run automatically
   - All tests must pass

3. **Pull Request**:
   - Create PR to `main` branch
   - CI runs again on PR
   - Review code
   - Merge if all tests pass

4. **Deployment**:
   - **Vercel**: Automatically deploys on merge to `main`
   - **Railway**: 
     - Option A: Manual "Deploy latest commit" from dashboard
     - Option B: Auto-deploy enabled (Settings → Source → Auto Deploy)

### Manual Deployment (Railway)

If auto-deploy is disabled:
1. Go to Railway dashboard
2. Select service
3. Click "Deploy" → "Deploy latest commit"

---

## 5. Environment Matrix

| Layer | Environment | URL | Notes |
|-------|------------|-----|-------|
| **Backend** | Dev | `http://localhost:8000` | Local development |
| **Backend** | Prod | `https://api.ezacore.ai` | Railway/Render |
| **Frontend** | Dev | `http://localhost:3000` | Local development |
| **Standalone** | Prod | `https://standalone.ezacore.ai` | Vercel |
| **Proxy** | Prod | `https://proxy.ezacore.ai` | Vercel |
| **Corporate** | Prod | `https://corporate.ezacore.ai` | Vercel |
| **Regulator** | Prod | `https://regulator.ezacore.ai` | Vercel |
| **Platform** | Prod | `https://platform.ezacore.ai` | Vercel |
| **Admin** | Prod | `https://admin.ezacore.ai` | Vercel |

---

## 6. Post-Deployment Checklist

### Backend
- [ ] Health check endpoint (`/health`) responds
- [ ] API documentation (`/docs`) accessible
- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] Redis connection working
- [ ] CORS whitelist includes production domains
- [ ] Rate limiting functional
- [ ] JWT authentication working
- [ ] WebSocket endpoints accessible

### Frontend
- [ ] All domains configured and accessible
- [ ] Environment variables set
- [ ] Build succeeds
- [ ] Standalone page loads (public)
- [ ] Login page accessible
- [ ] Protected routes redirect to login
- [ ] WebSocket connections work (with JWT)
- [ ] API calls use correct backend URL

### Security
- [ ] JWT secret is strong and secure
- [ ] Admin API key is secure
- [ ] CORS whitelist configured correctly
- [ ] Rate limiting active
- [ ] Sensitive data masking enabled (prod)
- [ ] HTTPS/WSS enabled

---

## 7. Monitoring & Logs

### Railway
- **Logs**: Dashboard → Deployments → Logs
- **Metrics**: Dashboard → Metrics (CPU, Memory, Network)
- **Alerts**: Configure in Settings → Notifications

### Vercel
- **Logs**: Dashboard → Deployments → Logs
- **Analytics**: Enable in Settings → Analytics
- **Speed Insights**: Enable in Settings → Speed Insights

### Custom Monitoring
- Set up external monitoring (e.g., UptimeRobot, Pingdom) for:
  - `https://api.ezacore.ai/health`
  - `https://standalone.ezacore.ai`
  - `https://corporate.ezacore.ai`

---

## 8. Troubleshooting

### Backend Issues

**Problem**: Health check failing
- Check logs in Railway dashboard
- Verify `uvicorn` command is correct
- Check port configuration

**Problem**: Database connection errors
- Verify `DATABASE_URL` is correct
- Check database is accessible from Railway
- Verify SSL/TLS settings if required

**Problem**: Redis connection errors
- Verify `EZA_REDIS_URL` or `REDIS_URL` is correct
- Check Redis instance is running
- Verify network access

### Frontend Issues

**Problem**: Build fails
- Check build logs in Vercel
- Verify all environment variables are set
- Check for TypeScript errors

**Problem**: API calls fail
- Verify `NEXT_PUBLIC_EZA_API_URL` is correct
- Check CORS configuration in backend
- Verify backend is accessible

**Problem**: WebSocket connection fails
- Verify `NEXT_PUBLIC_EZA_WS_URL` uses `wss://` (not `ws://`)
- Check WebSocket endpoint is accessible
- Verify JWT token is valid

---

## 9. Rollback Procedures

### Vercel Rollback
1. Go to Deployments
2. Find previous successful deployment
3. Click "..." → "Promote to Production"

### Railway Rollback
1. Go to Deployments
2. Find previous deployment
3. Click "Redeploy"

---

## 10. Future Enhancements

### TODO: Automated Deployment Pipeline
- [ ] GitHub Actions workflow for Railway auto-deploy
- [ ] Staging environment setup
- [ ] Blue-green deployment strategy
- [ ] Database migration automation
- [ ] Automated health checks post-deploy

### TODO: Monitoring & Alerting
- [ ] Set up Sentry for error tracking
- [ ] Configure PagerDuty for critical alerts
- [ ] Set up Grafana dashboards
- [ ] Configure log aggregation (e.g., Datadog, Logtail)

---

## 11. Support

For deployment issues:
1. Check logs in Railway/Vercel dashboards
2. Review GitHub Actions CI logs
3. Verify environment variables
4. Check DNS configuration
5. Review this documentation

---

**Last Updated**: 2025-01-15  
**Version**: 6.0.0  
**Status**: Production Ready

