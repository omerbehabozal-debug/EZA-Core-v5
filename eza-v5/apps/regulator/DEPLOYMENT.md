# Regulator Panel Deployment Guide

## Domain Configuration

The regulator panel is a **separate Next.js application** that should be deployed independently from the platform frontend.

### Vercel Deployment

1. **Create a new Vercel project** for the regulator panel
2. **Connect the `apps/regulator` directory** as the root
3. **Configure the domain** `regulator.ezacore.ai` to point to this project

### Environment Variables

Set in Vercel project settings:

```bash
NEXT_PUBLIC_API_URL=https://api.ezacore.ai  # Backend API URL
REGULATOR_DELAY_HOURS=0  # Optional: T+24 hour delay (frontend filtering)
```

### Build Settings

- **Framework Preset**: Next.js
- **Root Directory**: `apps/regulator` (if deploying from monorepo root)
- **Build Command**: `npm run build`
- **Output Directory**: `.next`

### Domain Routing

The regulator panel should be deployed as a **separate Vercel project** with its own domain:

- **Regulator Panel**: `regulator.ezacore.ai` → Separate Vercel project
- **Platform**: `platform.ezacore.ai` → Main frontend project

### Important Notes

1. **Platform middleware** has been updated to **NOT** handle `regulator.ezacore.ai`
2. Regulator panel has its **own middleware** for route protection
3. Both apps can share the same backend API
4. CORS is already configured in backend to allow `regulator.ezacore.ai`

## Local Development

```bash
cd apps/regulator
npm install
npm run dev  # Runs on port 3001
```

Access at: `http://localhost:3001`

## Production Checklist

- [ ] Regulator panel deployed as separate Vercel project
- [ ] Domain `regulator.ezacore.ai` configured in Vercel
- [ ] Environment variables set (`NEXT_PUBLIC_API_URL`)
- [ ] Backend CORS allows `regulator.ezacore.ai` (already configured)
- [ ] Platform middleware does NOT handle regulator domain (already fixed)

