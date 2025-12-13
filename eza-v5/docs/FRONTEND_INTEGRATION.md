# Frontend Backend Integration Guide

## Overview

Frontend artık gerçek backend API'leri ve güvenlik katmanı ile entegre edildi. Tüm endpoint'ler JWT authentication ve role-based access control ile korunuyor.

## Environment Variables

Create `.env.local` file in `eza-v5/frontend/`:

```bash
# Backend API URL
NEXT_PUBLIC_EZA_API_URL=http://localhost:8000

# WebSocket URL
NEXT_PUBLIC_EZA_WS_URL=ws://localhost:8000
```

## Authentication Flow

### 1. Login (Demo)

1. Navigate to `/login`
2. Paste JWT token (obtained from backend)
3. Select role (admin, corporate, regulator)
4. Click "Login"
5. Token is stored in localStorage and used for all authenticated requests

### 2. JWT Token Generation

For testing, generate JWT tokens from backend:

```python
from backend.auth.jwt import create_jwt

# Admin token
admin_token = create_jwt(user_id=1, role="admin")

# Corporate token
corporate_token = create_jwt(user_id=2, role="corporate")

# Regulator token
regulator_token = create_jwt(user_id=3, role="regulator")
```

## Pages & Routes

### 1. Standalone Chat (`/standalone` or `pages/standalone/index.tsx`)

- **Access**: Public (no authentication required)
- **Endpoint**: `POST /api/standalone`
- **Features**:
  - User input → Backend analysis
  - Displays `safe_answer`, `eza_score`, `risk_level`
  - Shows policy violations as badges
  - Loading states and error handling

### 2. Proxy Panel (`/proxy` or `app/proxy/page.tsx`)

- **Access**: Admin only
- **Endpoint**: `POST /api/proxy`
- **Features**:
  - Forensic view for developers/AI security team
  - Tabs: Overview, Raw Outputs, Alignment, Deep Analysis
  - Shows full pipeline results
  - Rate limited: 15 requests / 60s

### 3. Corporate Panel (`/corporate` or `app/corporate/page.tsx`)

- **Access**: Corporate or Admin
- **Endpoints**:
  - `GET /api/monitor/corporate-feed` (initial load)
  - `WS /ws/corporate?token=<JWT>` (real-time updates)
- **Features**:
  - Live telemetry feed table
  - Risk overview cards (high risk events, average score)
  - WebSocket real-time updates
  - Shows: timestamp, mode, eza_score, risk_level, summary

### 4. Regulator Panel (`/regulator` or `app/regulator/page.tsx`)

- **Access**: Regulator or Admin
- **Endpoints**:
  - `GET /api/monitor/regulator-feed` (initial load)
  - `WS /ws/regulator?token=<JWT>` (real-time updates)
- **Features**:
  - Filterable event table (risk level, mode, policy violations)
  - Event detail modal (full user_input, safe_answer, metadata)
  - WebSocket real-time updates
  - Rate limited: 10 requests / 60s

## API Client

### Usage

```typescript
import { apiClient } from '@/lib/apiClient';

// Public request (no auth)
const response = await apiClient.post('/api/standalone', {
  body: { text: 'Hello' },
  auth: false,
});

// Authenticated request
const response = await apiClient.get('/api/monitor/corporate-feed', {
  auth: true, // Automatically adds JWT from localStorage
  params: { limit: '50' },
});
```

### Response Format

```typescript
interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: {
    error_code?: string;
    error_message?: string;
    message?: string;
  };
}
```

## WebSocket Hook

### Usage

```typescript
import { useWebSocket } from '@/hooks/useWebSocket';

const { isConnected, lastMessage } = useWebSocket({
  path: '/ws/corporate',
  onMessage: (data) => {
    // Handle new telemetry event
    console.log('New event:', data);
  },
  enabled: true,
});
```

## Authentication Context

### Usage

```typescript
import { useAuth } from '@/context/AuthContext';

function MyComponent() {
  const { token, role, isAuthenticated, setAuth, logout } = useAuth();
  
  // Check authentication
  if (!isAuthenticated) {
    // Redirect to login
  }
  
  // Check role
  if (role !== 'admin') {
    // Show access denied
  }
}
```

## Protected Routes

### RequireAuth Component

```typescript
import RequireAuth from '@/components/auth/RequireAuth';

export default function MyPage() {
  return (
    <RequireAuth allowedRoles={['admin', 'corporate']}>
      <div>Protected content</div>
    </RequireAuth>
  );
}
```

## Domain Routing

Middleware enforces domain-based routing:

- `standalone.ezacore.ai` → `/standalone`
- `proxy.ezacore.ai` → `/proxy`
- `corporate.ezacore.ai` → `/corporate`
- `regulator.ezacore.ai` → `/regulator`

All domains can access `/login`.

## Testing

### 1. Standalone (Public)

```bash
# No auth required
curl -X POST http://localhost:8000/api/standalone \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello"}'
```

### 2. Proxy (Admin)

```bash
# Requires admin JWT
curl -X POST http://localhost:8000/api/proxy \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_jwt_token>" \
  -d '{"message": "Test"}'
```

### 3. Corporate Feed (Corporate/Admin)

```bash
# Requires corporate/admin JWT
curl -X GET "http://localhost:8000/api/monitor/corporate-feed?limit=50" \
  -H "Authorization: Bearer <corporate_jwt_token>"
```

### 4. WebSocket (Corporate)

```javascript
const token = 'your_jwt_token';
const ws = new WebSocket(`ws://localhost:8000/ws/corporate?token=${token}`);

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type !== 'heartbeat') {
    console.log('New event:', data);
  }
};
```

## Error Handling

All API calls handle errors gracefully:

- **401 Unauthorized**: Redirects to `/login`
- **403 Forbidden**: Shows "Access Denied" message
- **429 Rate Limit**: Shows rate limit error message
- **Network Errors**: Shows user-friendly error message

## Rate Limits

- **Standalone**: 40 requests / 60s (per IP)
- **Proxy**: 15 requests / 60s (per IP)
- **Regulator Feed**: 10 requests / 60s (per IP)
- **WebSocket Handshake**: 20 requests / 120s (per IP)

## Security Features

1. **JWT Authentication**: All protected endpoints require valid JWT
2. **Role-Based Access**: Each page checks user role
3. **CORS Protection**: Backend whitelist enforces allowed origins
4. **Rate Limiting**: Prevents abuse
5. **Sensitive Data Masking**: Production logs mask sensitive fields

## Next Steps

1. **Production Login**: Replace demo login with real authentication
2. **Token Refresh**: Implement token refresh mechanism
3. **Error Boundaries**: Add React error boundaries for better error handling
4. **Loading States**: Enhance loading skeletons
5. **Responsive Design**: Ensure all pages work on mobile devices

## Troubleshooting

### WebSocket Connection Fails

- Check JWT token is valid and not expired
- Verify token is passed in query parameter: `?token=xxx`
- Check role matches channel requirements
- Verify backend WebSocket endpoint is running

### API Calls Return 401

- Check JWT token is stored in localStorage
- Verify token is not expired (8 hours default)
- Ensure token is sent in `Authorization: Bearer <token>` header

### CORS Errors

- Verify frontend origin is in backend CORS whitelist
- Check `NEXT_PUBLIC_EZA_API_URL` matches backend URL
- Ensure credentials are allowed in CORS config

---

**Last Updated**: 2025-01-15  
**Version**: 6.0.0

