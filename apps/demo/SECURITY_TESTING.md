# Security Testing Guide - Auth Bypass Fix

## Vulnerability Fixed

**CVE:** Auth Bypass via Falsifiable Header
**Severity:** CRITICAL
**Affected Endpoints:**

- `/api/start-custom-session`
- `/api/elevenlabs-conversation`

## Before Fix (VULNERABLE)

```typescript
// ❌ INSECURE: Any client can set this header
const isShopifyUser = request.headers.get("x-shopify-validated") === "true";
```

**Attack Vector:**

```bash
# Attacker bypasses auth by setting header
curl -X POST https://app.com/api/start-custom-session \
  -H "x-shopify-validated: true" \
  -H "Content-Type: application/json"
# ❌ Unauthorized access granted!
```

## After Fix (SECURE)

```typescript
// ✅ SECURE: Server-side HMAC validation
if (shopifyCustomerId && shopifyToken) {
  const cleanId = cleanCustomerId(shopifyCustomerId);
  if (
    isValidCustomerId(cleanId) &&
    verifyCustomerToken(shopifyToken, cleanId)
  ) {
    isShopifyUser = true; // ✅ Cryptographically verified
  }
}
```

**Protected:**

```bash
# Without valid HMAC, request is rejected
curl -X POST https://app.com/api/start-custom-session \
  -H "Content-Type: application/json" \
  -d '{"customer_id":"123","shopify_token":"fake"}'
# ✅ 401 Unauthorized
```

## Authentication Methods

Both endpoints now accept **either**:

1. **NextAuth Session** (Google/Credentials login)
   - Set via cookie automatically
   - Validates via `auth()` function

2. **Shopify HMAC Token** (iframe users)
   - Requires `customer_id` + `shopify_token` in request body
   - Validates via `verifyCustomerToken(token, customerId)`
   - Uses timing-safe comparison (prevents timing attacks)
   - HMAC-SHA256 with secret key

## Test Cases

### Test 1: Valid NextAuth Session

```bash
# Login via /login → session cookie set
curl -X POST https://app.com/api/start-custom-session \
  -H "Cookie: authjs.session-token=..." \
  -H "Content-Type: application/json" \
  -d '{"deviceType":"desktop"}'
# ✅ Expected: 200 OK with session_token
```

### Test 2: Valid Shopify HMAC

```bash
# Generate HMAC: echo -n "123" | openssl dgst -sha256 -hmac "SECRET"
curl -X POST https://app.com/api/start-custom-session \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id":"123",
    "shopify_token":"valid_hmac_here",
    "deviceType":"mobile"
  }'
# ✅ Expected: 200 OK with session_token
```

### Test 3: Invalid HMAC (Attack Attempt)

```bash
curl -X POST https://app.com/api/start-custom-session \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id":"123",
    "shopify_token":"fake_token",
    "deviceType":"desktop"
  }'
# ✅ Expected: 401 Unauthorized
# Console log: "[AUTH] Invalid Shopify HMAC attempt for: 123"
```

### Test 4: Header Injection Attack (Blocked)

```bash
# Try to bypass with old vulnerable header
curl -X POST https://app.com/api/start-custom-session \
  -H "x-shopify-validated: true" \
  -H "Content-Type: application/json"
# ✅ Expected: 401 Unauthorized (header ignored)
```

### Test 5: No Auth at All

```bash
curl -X POST https://app.com/api/start-custom-session \
  -H "Content-Type: application/json" \
  -d '{"deviceType":"desktop"}'
# ✅ Expected: 401 Unauthorized
# Response: {"error":"Unauthorized","message":"Valid session or Shopify credentials required"}
```

## Security Improvements

| Aspect             | Before             | After                       |
| ------------------ | ------------------ | --------------------------- |
| **Auth Method**    | Falsifiable header | HMAC-SHA256 validation      |
| **Attack Surface** | Any HTTP client    | Requires secret key         |
| **Timing Attack**  | Vulnerable         | Protected (timingSafeEqual) |
| **Logging**        | Silent failure     | Logs invalid attempts       |
| **Error Messages** | Generic            | Descriptive for debugging   |

## Implementation Details

### Files Changed

- `apps/demo/app/api/start-custom-session/route.ts`
- `apps/demo/app/api/elevenlabs-conversation/route.ts`

### Security Functions Used

```typescript
// From @/src/shopify/security.ts
verifyCustomerToken(token: string, customerId: string): boolean
isValidCustomerId(customerId: string): boolean
cleanCustomerId(customerId: string): string
```

### Crypto Operations

- **Algorithm:** HMAC-SHA256
- **Comparison:** `crypto.timingSafeEqual()` (constant-time)
- **Key Source:** `SHOPIFY_HMAC_SECRET` environment variable

## Environment Variables Required

```bash
# .env (production)
SHOPIFY_HMAC_SECRET=your_shopify_app_hmac_secret
AUTH_SECRET=your_nextauth_secret
```

## Monitoring & Alerts

Watch for these log patterns:

```bash
# Normal flow
"[AUTH] Valid Shopify HMAC for customer: 123"

# Attack attempts
"[AUTH] Invalid Shopify HMAC attempt for: 123"
"UNAUTHORIZED - no session and no valid Shopify HMAC"
```

## Regression Testing

Before deploying:

1. ✅ Build passes (`pnpm build`)
2. ✅ TypeScript checks (`pnpm typecheck`)
3. ✅ Linting passes (`pnpm lint`)
4. ✅ Manual test: Login via Google → start session
5. ✅ Manual test: Access from Shopify iframe → validate HMAC
6. ✅ Manual test: Direct API call without auth → 401

## Backward Compatibility

**Breaking Change:** ❌ None

- NextAuth sessions continue to work (no changes)
- Shopify iframe flow continues to work (now more secure)
- Only difference: `x-shopify-validated` header is now ignored
- Frontend doesn't send this header anyway (was never used)

## Next Steps

1. Deploy to staging
2. Test both auth flows (NextAuth + Shopify)
3. Monitor logs for attack attempts
4. Deploy to production
5. Add rate limiting alerts (already implemented)

## References

- OWASP: [Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- HMAC: [RFC 2104](https://www.rfc-editor.org/rfc/rfc2104)
- Timing Attacks: [Constant-Time Comparison](https://codahale.com/a-lesson-in-timing-attacks/)
