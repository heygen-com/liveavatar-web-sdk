# Testing Guide - Rate Limiting & Database Integration

## Quick Start

### Automated Testing (Recommended)

```bash
cd apps/demo

# Test locally
./test-features.sh http://localhost:3001

# Test Preview deployment
./test-features.sh https://your-preview-url.vercel.app
```

---

## Manual Testing

### 1️⃣ Test Rate Limiting

#### Test Endpoint: `/api/start-custom-session` (5 requests / 15 minutes)

```bash
# Request 1 - Should succeed
curl -X POST http://localhost:3001/api/start-custom-session \
  -H "Content-Type: application/json" \
  -d '{"quality":"low"}' \
  -i

# Check headers in response:
# X-RateLimit-Limit: 5
# X-RateLimit-Remaining: 4
# X-RateLimit-Reset: <timestamp>
```

**Make 6 requests rapidly:**

```bash
for i in {1..6}; do
  echo "Request $i"
  curl -X POST http://localhost:3001/api/start-custom-session \
    -H "Content-Type: application/json" \
    -d '{"quality":"low"}' \
    -w "\nHTTP Status: %{http_code}\n\n" \
    -s | head -3
  sleep 1
done
```

**Expected:**

- Requests 1-5: HTTP 200 ✅
- Request 6: HTTP 429 (Rate Limited) ✅

**Response on rate limit:**

```json
{
  "error": "Too many requests",
  "message": "Rate limit exceeded. Try again in 15 minutes.",
  "retryAfter": 900
}
```

---

### 2️⃣ Test Database - Shopify Customer Cache

#### Test Endpoint: `/api/shopify-customer` (10 requests / 5 minutes)

**First Request (Cache Miss):**

```bash
curl "http://localhost:3001/api/shopify-customer?email=test@example.com"
```

**Expected Response:**

```json
{
  "valid": false,
  "cached": false,
  "message": "Customer not found or invalid"
}
```

**Second Request (Cache Hit):**

```bash
curl "http://localhost:3001/api/shopify-customer?email=test@example.com"
```

**Expected Response:**

```json
{
  "valid": false,
  "cached": true, // ✅ Database cache working!
  "message": "Customer not found or invalid"
}
```

---

### 3️⃣ Test All Rate-Limited Endpoints

| Endpoint                       | Limit | Window | Test Command                                                                                                                                    |
| ------------------------------ | ----- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/start-custom-session`    | 5     | 15 min | `curl -X POST http://localhost:3001/api/start-custom-session -H "Content-Type: application/json" -d '{"quality":"low"}' -i`                     |
| `/api/elevenlabs-conversation` | 10    | 1 hour | `curl -X POST http://localhost:3001/api/elevenlabs-conversation -H "Content-Type: application/json" -d '{"message":"test"}' -i`                 |
| `/api/verify-customer`         | 10    | 5 min  | `curl -X POST http://localhost:3001/api/verify-customer -H "Content-Type: application/json" -d '{"email":"test@example.com","token":"abc"}' -i` |
| `/api/shopify-customer`        | 10    | 5 min  | `curl "http://localhost:3001/api/shopify-customer?email=test@example.com" -i`                                                                   |

---

### 4️⃣ Inspect Rate Limit Headers

```bash
curl -I http://localhost:3001/api/start-custom-session \
  -H "Content-Type: application/json" \
  -d '{"quality":"low"}'
```

**Headers to look for:**

```
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 4
X-RateLimit-Reset: 1704123456
```

---

### 5️⃣ Test Database Session Tracking

**Start a session:**

```bash
curl -X POST http://localhost:3001/api/start-custom-session \
  -H "Content-Type: application/json" \
  -d '{
    "quality": "low",
    "userId": "test-user-123",
    "deviceType": "desktop"
  }'
```

**Check server logs:**

```bash
# In your terminal running `pnpm dev`
# Look for:
[DB] Session created: ses_xxxxxxxxxxxxx
```

**Stop a session:**

```bash
curl -X POST http://localhost:3001/api/stop-session \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "YOUR_SESSION_ID_HERE"
  }'
```

---

## Verify in Dashboards

### Vercel KV (Redis) - Rate Limit Data

1. Go to [Vercel Dashboard](https://vercel.com)
2. Select your project
3. Navigate to **Storage** → **KV**
4. Click on your KV store
5. Go to **Data Browser**

**Look for keys:**

```
ratelimit:api:start-custom-session:127.0.0.1
ratelimit:api:elevenlabs-conversation:127.0.0.1
blacklist:ips
```

---

### Vercel Postgres - Database Records

1. Go to [Vercel Dashboard](https://vercel.com)
2. Select your project
3. Navigate to **Storage** → **Postgres**
4. Click on your database
5. Go to **Query**

**Test queries:**

```sql
-- View all sessions
SELECT id, "sessionToken", status, "deviceType", "createdAt"
FROM sessions
ORDER BY "createdAt" DESC
LIMIT 10;

-- View Shopify customer cache
SELECT "shopifyEmail", "cachedAt", "expiresAt"
FROM shopify_customer_cache
ORDER BY "cachedAt" DESC;

-- View session analytics
SELECT s.id, s.status, a."messagesExchanged", a."leadQuality"
FROM sessions s
LEFT JOIN session_analytics a ON s.id = a."sessionId"
ORDER BY s."createdAt" DESC
LIMIT 10;

-- Daily metrics
SELECT date, "totalSessions", "uniqueUsers", "averageDuration"
FROM daily_metrics
ORDER BY date DESC;
```

---

## Troubleshooting

### Rate Limiting Not Working

**Check:**

1. Is `KV_URL` set in environment variables?
2. Check logs for `[RATE LIMIT]` prefix
3. Verify Vercel KV is connected: `pnpm dev` should show no errors

**Test Redis connection:**

```bash
# In apps/demo
node -e "
const { kv } = require('@vercel/kv');
kv.set('test-key', 'hello').then(() => {
  console.log('✓ Redis connected');
  return kv.get('test-key');
}).then(val => {
  console.log('✓ Value:', val);
}).catch(err => {
  console.error('✗ Redis error:', err);
});
"
```

---

### Database Not Working

**Check:**

1. Is `POSTGRES_PRISMA_URL` set?
2. Check logs for `[DB] Prisma Client not available`
3. Run `npx prisma generate` in `apps/demo`

**Test Prisma connection:**

```bash
cd apps/demo

# Check if Prisma client is generated
npx prisma generate

# Test connection
npx prisma db execute --sql "SELECT 1"
```

---

## Expected Behaviors

### ✅ Rate Limiting Working

- First 5 requests to `/api/start-custom-session` succeed
- 6th request returns HTTP 429
- Headers show `X-RateLimit-*` in all responses
- After 15 minutes, limit resets automatically

### ✅ Database Working

- Sessions are created and stored
- Shopify customer cache returns `"cached": true` on second request
- No `[DB] Prisma Client not available` errors in logs
- Queries in Vercel Postgres dashboard return data

### ✅ Both Working Together

- Rate-limited requests are logged
- Session tracking works even when rate limited
- Shopify cache reduces duplicate API calls
- Analytics are updated in real-time

---

## Performance Metrics

Monitor these in production:

1. **Rate Limit Hit Rate**: How often users hit limits
   - Query: Check `ratelimit:*` key counts in Redis

2. **Cache Hit Rate**: Shopify customer cache effectiveness
   - Target: >80% cache hit rate

3. **Average Session Duration**: User engagement
   - Query: `SELECT AVG("durationSeconds") FROM sessions`

4. **Daily Active Users**: Growth metric
   - Query: `SELECT * FROM daily_metrics ORDER BY date DESC`

---

## Next Steps

After verifying both features work:

1. ✅ Monitor production logs for rate limit violations
2. ✅ Set up alerts in Vercel for high error rates
3. ✅ Review analytics weekly using database queries
4. ✅ Adjust rate limits based on usage patterns
5. ✅ Consider implementing user-based rate limiting (vs IP-based)

---

## Support

If you encounter issues:

1. Check `apps/demo/.env.local` for required variables
2. Review `RATE_LIMITING_IMPLEMENTATION.md` for detailed config
3. Review `DATABASE_INTEGRATION_IMPLEMENTATION.md` for schema details
4. Check server logs for `[RATE LIMIT]` and `[DB]` prefixes
