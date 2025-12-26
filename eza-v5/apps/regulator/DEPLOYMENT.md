# Regulator Panel Deployment Guide

## Domain Configuration

The regulator panel is a **separate Next.js application** that should be deployed independently from the platform frontend.

### Vercel Deployment

#### Option 1: Separate Vercel Project (Recommended)

1. **Create a new Vercel project** for the regulator panel
2. **Root Directory**: Set to `apps/regulator` in **Vercel Project Settings** (UI)
   - Go to Project Settings → General → Root Directory
   - Set to `apps/regulator` (if deploying from monorepo root)
   - OR deploy `apps/regulator` folder directly as root
3. **Configure the domain** `regulator.ezacore.ai` to point to this project

**Important**: Do NOT use `rootDirectory` in `vercel.json`. Set it in Vercel Project Settings (UI) instead.

#### Option 2: Monorepo Deployment

If deploying from monorepo root:

1. **Root Directory**: `apps/regulator`
2. **Build Command**: `npm install && npm run build` (runs in root directory)
3. **Install Command**: `npm install` (runs in root directory)

**Important**: Make sure `package.json` in `apps/regulator` has all dependencies including ESLint.

### Environment Variables

Set in Vercel project settings:

```bash
NEXT_PUBLIC_API_URL=https://api.ezacore.ai  # Backend API URL
REGULATOR_DELAY_HOURS=0  # Optional: T+24 hour delay (frontend filtering)
```

### Build Settings

- **Framework Preset**: Next.js
- **Root Directory**: `apps/regulator` (if deploying from monorepo)
- **Build Command**: `npm run build` (if root is `apps/regulator`)
- **Output Directory**: `.next`

### Fixing ESLint Warning

If you see ESLint warning during build:

1. **Ensure `package.json` includes ESLint**:
   ```json
   {
     "devDependencies": {
       "eslint": "^8.57.0",
       "eslint-config-next": "^14.0.0"
     }
   }
   ```

2. **If deploying from monorepo root**, ensure dependencies are installed:
   ```bash
   cd apps/regulator
   npm install
   ```

3. **Or disable ESLint during build** (not recommended):
   Add to `next.config.js`:
   ```js
   eslint: {
     ignoreDuringBuilds: true,
   }
   ```

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
- [ ] Root Directory set to `apps/regulator` (if monorepo)
- [ ] Environment variables set (`NEXT_PUBLIC_API_URL`)
- [ ] ESLint installed (check `package.json`)
- [ ] Backend CORS allows `regulator.ezacore.ai` (already configured)
- [ ] Platform middleware does NOT handle regulator domain (already fixed)

## Troubleshooting

### ESLint Warning During Build

**Solution 1**: Ensure ESLint is in `devDependencies`:
```json
"devDependencies": {
  "eslint": "^8.57.0",
  "eslint-config-next": "^14.0.0"
}
```

**Solution 2**: If root directory is `apps/regulator`, run:
```bash
cd apps/regulator
npm install
```

**Solution 3**: Temporarily disable ESLint (not recommended):
```js
// next.config.js
eslint: {
  ignoreDuringBuilds: true,
}
```

### Build Fails

- Check that `package.json` is in the correct location
- Verify all dependencies are listed
- Ensure Node.js version is compatible (18+)
