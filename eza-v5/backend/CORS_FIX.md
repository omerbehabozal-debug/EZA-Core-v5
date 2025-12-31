# CORS Fix for eza.global

## Sorun

`https://eza.global` domain'i CORS allowed_origins listesinde yoktu, bu yüzden frontend'den API'ye erişilemiyordu.

## Çözüm

`eza.global` ve `www.eza.global` domain'leri CORS allowed_origins listesine eklendi.

## Değişiklikler

```python
allowed_origins = [
    # ... existing domains ...
    "https://eza.global",  # Documentation site
    "https://www.eza.global",  # Documentation site (www)
    # ... rest of domains ...
]
```

## Test

Endpoint'ler artık `eza.global`'dan çağrılabilir:

```typescript
// eza.global frontend'den
const response = await fetch('https://api.ezacore.ai/api/test-results/comprehensive');
const data = await response.json();
```

## Not

Production'a deploy edildikten sonra endpoint çalışacak.

