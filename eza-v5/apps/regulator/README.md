# Regulator Oversight Panel

**Read-Only · Content-Free · Audit-Grade**

## Overview

The Regulator Oversight Panel is a frontend-only application that provides regulators with observational access to system behavior metrics and audit logs. It does **NOT** display content, does **NOT** allow content modification, and operates in **READ-ONLY** mode.

## Key Principles

- ❌ **NO content display** - Regulators cannot see user content
- ❌ **NO backend changes** - Uses existing GET endpoints only
- ❌ **NO new RBAC** - Frontend-only role enforcement
- ✅ **READ-ONLY** - All operations are read-only
- ✅ **Content-free** - Only aggregate metrics and masked data
- ✅ **Audit-grade** - Based on existing audit logs

## Access Control

Only users with the following roles can access:
- `REGULATOR_READONLY`
- `REGULATOR_AUDITOR`

**Important**: Role validation is enforced **ONLY** in the frontend. No backend RBAC changes are made.

## Domain

- **Regulator Panel**: `regulator.ezacore.ai`
- **Platform Panel**: `platform.ezacore.ai` (separate application)

## Features

### 1. Dashboard
- Aggregate metrics (no content)
- Risk distribution (High/Medium/Low)
- Time-based analysis volume
- Active policy set count
- System flag counts
- Charts: Average ethical score over time, Risk score distribution

### 2. Audit Logs
- Read-only audit log viewer
- Organization masking (ORG-0042 format)
- Filters: Date range, Policy set, Content type
- **NEVER shows**: Content body, Prompts, Images, Audio, Transcripts, Rewritten text

### 3. Reports
- Aggregate views of audit data
- Risk trends over time
- Policy-based risk distribution
- Flag frequency patterns
- **NO PDF/CSV export** (but tables are export-ready)

### 4. Alerts
- Observational alerts only
- Pattern-based threshold alerts
- **NO action buttons** (Resolve, Dismiss, Enforcement)
- **NO intervention** capabilities

## API Client

The regulator frontend uses a **GET-only API client** that:
- ✅ Allows only GET requests
- ❌ Blocks POST/PATCH/DELETE at runtime
- ❌ Blocks Analyze/Proxy/Rewrite endpoints
- ❌ Blocks API key management endpoints

## Organization Masking

All organization identifiers are masked:
- Real names are **NEVER** shown
- Format: `ORG-0042` or fixed hash alias
- Applied in frontend only

## Legal Disclaimer

All pages display:

> "This panel does not display content. Regulators are not responsible for editorial decisions or content outcomes. This system is not a censorship or intervention tool."

## Development

```bash
# Install dependencies
npm install

# Run development server (port 3001)
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Architecture

- **Frontend-only**: No backend modifications
- **Separate app**: Independent from platform UI
- **GET-only**: All API calls are read-only
- **Frontend aggregation**: Metrics calculated client-side from paginated audit logs

## Configuration

Optional: `REGULATOR_DELAY_HOURS=24` for T+24 hour view (frontend filtering only, no backend changes)

