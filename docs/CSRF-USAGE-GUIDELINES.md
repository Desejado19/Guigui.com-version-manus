# CSRF Usage Guidelines for API Consumers

## Overview

The Guigui.com API uses **CSRF protection** via the **double-submit cookie pattern**. All state-changing endpoints require an CSRF token to prevent cross-site request forgery attacks.

### Security Policy

| Aspect | Details |
|--------|---------|
| **Pattern** | Double-submit cookie: token in `X-CSRF-Token` header AND `_csrf` cookie |
| **Safe Methods** | GET, HEAD, OPTIONS are CSRF-exempt (RFC 7231) |
| **Exempt Endpoint** | `/api/health` — public status check |
| **CORS** | `credentials: 'include'` required for cookie transmission |
| **Rate Limiting** | Global limit: 30,000 req/30s (dev), 1,000 req/30s (prod) |
| **Admin Exemptions** | See "CSRF-Exempt Admin APIs" below |

---

## CSRF Token Requirements

### Header

```
X-CSRF-Token: <token-value>
```

### Cookie

```
_csrf=<token-value>
```

O servidor emite o cookie `_csrf` automaticamente em qualquer pedido (ou em `GET /api/csrf`, que devolve `{ csrfToken }`). Em métodos que alteram estado exige **os dois**: o cookie `_csrf` e o cabeçalho `X-CSRF-Token` com exatamente o mesmo valor. O `Origin` (ou, na sua falta, o `Referer`) também tem de pertencer ao próprio site. O único pedido dispensado é `POST /api/payments/webhook/:provider`, autenticado pela assinatura HMAC do fornecedor.

---

## API Consumer Implementation

### 1. Retrieve the CSRF Token

On page load, read the `_csrf` cookie:

```javascript
// Example: CitizenDashboard.tsx
useEffect(() => {
  const cookieHeader = document.cookie || '';
  const csrfMatch = cookieHeader.match(/(?:^|;\\s*)_csrf=([^;]+)/);
  if (csrfMatch) {
    // Store token in state for use in API calls
    setCsrfToken(csrfMatch[1]);
  }
}, []);
```

### 2. Send Token with State-Changing Requests

All POST, PUT, PATCH, and DELETE requests to `/api/` must include:

```javascript
fetch('/api/auth/change-password', {
  method: 'POST',
  credentials: 'include',    // <-- CRITICAL: sends _csrf cookie
  headers: {
    'X-CSRF-Token': csrfToken,  // <-- CSRF token header
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ currentPassword, newPassword }),
})
```

### 3. Error Handling

If the token is missing or invalid, the server responds with:

```json
{
  "error": "Token CSRF ausente.",
  "code": "CSRF_TOKEN_MISSING"
}
```

HTTP Status: **403 Forbidden**

Handle this in your frontend:

```javascript
if (!response.ok) {
  const errorData = await response.json().catch(() => ({}));
  setPasswordMessage(errorData.detail || `Erro ${response.status}: Não foi possível atualizar a palavra-passe.`);
  setPasswordSubmitting(false);
  return;
}
```

---

## CSRF-Exempt Admin/Internal APIs

The following endpoints **do NOT require** a CSRF token (they are safe GET read-only operations):

| Endpoint | Description |
|----------|-------------|
| `GET /api/admin/*` | Read-only dashboard data (behind auth) |
| `GET /api/marketing/scheduled-items/public` | Public promotion listing |
| `GET /api/features` | Feature flags (read-only) |
| `GET /api/app-state/:key` | State reading via query parameter |
| `GET /api/health` | Public health check endpoint |

**All other routes** (POST, PUT, PATCH, DELETE) **require** the `X-CSRF-Token` header.

---

## CORS & Credentials

The API requires credentials for cookie-based authentication:

```javascript
fetch('/api/endpoint', {
  method: 'POST',
  credentials: 'include',    // Sends session cookie AND _csrf cookie
  // ... headers
})
```

Without `credentials: 'include'`, the `_csrf` cookie won't be transmitted and the request will fail with 403.

---

## Rate Limiting

A API global é limitada por IP. Além disso, existem baldes distribuídos por conta em `rate_limit_buckets`:

- **Login:** 10 tentativas falhadas por 15 minutos; um login bem-sucedido limpa o balde.
- **Lookup de bilhetes:** 5 tentativas por 10 minutos, por telefone.
- **Reset de palavra-passe:** 5 pedidos por 15 minutos, por e-mail; e 5 tentativas por 15 minutos por token.

O IP usado é `req.ip`, respeitando `TRUST_PROXY` (por omissão `loopback` em desenvolvimento e `1` em produção).

Exceeding the limit returns:

```json
{
  "error": "Demasiados pedidos. Tente novamente dentro de um minuto.",
  "code": "RATE_LIMITED"
}
```

HTTP Status: **429 Too Many Requests**

---

## Development Tips

### Testing CSRF

When writing tests that hit state-changing endpoints:

1. **Set the `_csrf` cookie** before making the request
2. **Include `X-CSRF-Token` header** with the cookie value
3. **Use `credentials: 'include'`** to ensure cookies are transmitted

### Common Pitfalls

| Issue | Cause | Fix |
|-------|-------|-----|
| `403 CSRF_TOKEN_MISSING` | Forgetting `X-CSRF-Token` header | Read `_csrf` cookie on mount, add header to all POST/PUT/PATCH/DELETE |
| `403` with valid token | Missing `credentials: 'include'` | Add `credentials: 'include'` to fetch config |
| `429 RATE_LIMITED` | Too many requests from same IP | Implement request throttling, check rate limit headers |
| Token not being read | Cookie not yet set or regex mismatch | Ensure cookie `name=csrf` format, test regex `/(?:^|;\\s*)csrf=([^;]+)/` |

---

## Client-Side Code Example (Complete Pattern)

```javascript
// In component mount (e.g., CitizenDashboard.tsx):
useEffect(() => {
  const cookieHeader = document.cookie || '';
  const csrfMatch = cookieHeader.match(/(?:^|;\\s*)csrf=([^;]+)/);
  if (csrfMatch) {
    setCsrfToken(csrfMatch[1]);
  }
}, []);

// For each state-changing API call:
const submitForm = async (e) => {
  e.preventDefault();
  
  const response = await fetch('/api/auth/change-password', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'X-CSRF-Token': csrfToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      currentPassword: currentPassword,
      newPassword: newPassword,
    }),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    setErrorMessage(error.detail || 'Erro desconhecido.');
    return;
  }
  
  setSuccessMessage('Palavra-passe atualizada com sucesso.');
  // ... reset form, etc.
};
```

---

## Compliance & OWASP Alignment

This implementation follows **OWASP CSRF Prevention Cheat Sheet** guidelines:

1. ✅ **Double-submit cookie pattern** — token in both header and cookie
2. ✅ **Safe methods exempt** — GET, HEAD, OPTIONS per RFC 7231
3. ✅ **Aligns with CORS** — `credentials: 'include'` for cookie transmission
4. ✅ **Server-side validation** — token checked against cookie, not client-trusted
5. ✅ **No secrets in client code** — token read from cookie at runtime

---

## Questions & Support

For questions about CSRF implementation or API integration:

- Review the `server.ts` middleware (lines ~287-328) for the exact validation logic
- Check `src/components/CitizenDashboard.tsx` for the frontend implementation pattern
- Consult the `INTERNATIONALIZATION.md` doc for locale-specific error message handling