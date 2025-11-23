# EZA v5 API Specification

## Authentication

### POST /api/auth/login

Login endpoint for user authentication.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "mfa_code": "123456" // optional
}
```

**Response:**
```json
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "role": "public_user",
  "expires_in": 1800
}
```

## Standalone Mode

### POST /api/standalone/chat

Fast Core Pipeline endpoint for standalone mode.

**Request:**
```json
{
  "message": "What is AI?",
  "conversation_id": "uuid" // optional
}
```

**Response:**
```json
{
  "answer": "AI is...",
  "safety_level": "green",
  "confidence": 0.97,
  "conversation_id": "uuid"
}
```

## Proxy Mode

### POST /api/proxy/eval

Internal lab evaluation endpoint.

**Request:**
```json
{
  "message": "Test message",
  "model": "gpt-4",
  "depth": "fast" // or "deep"
}
```

**Response:**
```json
{
  "raw_model_output": "...",
  "safe_output": "...",
  "input_analysis": {...},
  "output_analysis": {...},
  "alignment": {...},
  "redirect_summary": {...},
  "score_breakdown": {...},
  "drift": {...}, // if depth=deep
  "risk_nodes": {...}, // if depth=deep
  "deception": {...}, // if depth=deep
  "psych_pressure": {...}, // if depth=deep
  "legal_risk": {...} // if depth=deep
}
```

## Proxy-Lite Mode

### POST /api/proxy-lite/report

Institution audit report endpoint.

**Request:**
```json
{
  "message": "Input message",
  "output_text": "Output to audit"
}
```

**Response:**
```json
{
  "risk_level": "high",
  "risk_category": "legal_compliance",
  "violated_rule_count": 2,
  "summary": "Risk assessment completed...",
  "recommendation": "Content requires review..."
}
```

## Admin

### GET /api/admin/dashboard

Admin dashboard endpoint.

### GET /api/admin/users

List all users (admin only).

### GET /api/admin/stats

System statistics (admin only).

