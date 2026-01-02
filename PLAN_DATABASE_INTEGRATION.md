# Plan de Integración de Base de Datos - Clara Voice Agent

**Fecha:** 2026-01-02
**Estado:** Pendiente aprobación
**Stack Tecnológico:** Vercel Postgres (Hobby - GRATIS) + Prisma ORM

---

## 1. ANÁLISIS DE NECESIDADES

### Estado Actual ❌

- **Sin persistencia:** Todo se obtiene de APIs en tiempo real
- **Sin cache:** Cada request golpea Shopify API (límites estrictos)
- **Sin analytics:** No se trackea uso, errores, engagement
- **Sin optimización:** Datos duplicados se re-fetc clean constantemente

### Datos a Persistir 📊

#### A. **Customer Data (Cache de Shopify)**

```typescript
// Evitar rate limits de Shopify API
- customer_id (Shopify)
- email
- firstName, lastName
- skinType, skinConcerns
- ordersCount
- lastSyncedAt (cache invalidation)
```

#### B. **Session Analytics**

```typescript
// Métricas de uso y debugging
(-sessionId - userId - startTime,
  endTime - duration - deviceType(mobile / desktop) - browser,
  os - interruptions(count) - errors(array) - successfulCompletion(boolean));
```

#### C. **Conversation Logs (Parcial)**

```typescript
// Solo metadata, NO transcripts completos (privacy)
- sessionId
- messageCount
- averageResponseTime
- topics (array) - ej: ["acne", "moisturizer"]
- sentiment (positive/neutral/negative)
```

#### D. **Error Tracking**

```typescript
// Debugging y monitoreo
-timestamp -
  errorType -
  errorMessage -
  stackTrace -
  userId(opcional) -
  sessionId(opcional) -
  context(JSON);
```

#### E. **Feature Flags**

```typescript
// Control de features sin deploy
-flagName -
  enabled(boolean) -
  rolloutPercentage(0 - 100) -
  targetUsers(array, opcional);
```

---

## 2. ARQUITECTURA PROPUESTA

### 🎯 **Opción Elegida: Vercel Postgres (Hobby Tier - GRATIS)**

#### Ventajas ✅

- **100% gratis** hasta 256MB storage
- **Zero config** en Vercel deploy
- **Serverless** - no hay que gestionar servidor
- **Prisma ORM** - Type-safe, migrations automáticas
- **60h compute/month** (más que suficiente para demo)

#### Límites del Plan Gratuito

- Storage: 256MB (suficiente para ~50K sessions)
- Compute: 60h/month (renovable)
- Requests: Ilimitados dentro de compute hours

#### Alternativas Descartadas

- **Supabase:** Requiere configuración extra, no tan integrado
- **PlanetScale:** Pausado plan gratuito
- **MongoDB Atlas:** Overkill para datos relacionales simples

### Stack Completo

```
Next.js App Router (apps/demo)
     ↓
Prisma Client (type-safe ORM)
     ↓
Vercel Postgres (Neon serverless)
```

---

## 3. SCHEMA DE DATABASE (Prisma)

### Ubicación: `apps/demo/prisma/schema.prisma` (nuevo)

```prisma
// Prisma schema para Clara Voice Agent
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("POSTGRES_URL")
  directUrl = env("POSTGRES_URL_NON_POOLING")
}

// ============================================
// CUSTOMER CACHE (datos de Shopify)
// ============================================
model Customer {
  id            String   @id @default(cuid())
  shopifyId     String   @unique // customer_id de Shopify
  email         String   @unique
  firstName     String?
  lastName      String?
  skinType      String?
  skinConcerns  String[] // array de concerns
  ordersCount   Int      @default(0)

  // Metadata
  lastSyncedAt  DateTime @default(now())
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  // Relations
  sessions      Session[]

  @@index([email])
  @@index([shopifyId])
}

// ============================================
// SESSION ANALYTICS
// ============================================
model Session {
  id                    String   @id @default(cuid())

  // User info
  customerId            String?
  customer              Customer? @relation(fields: [customerId], references: [id])
  anonymousId           String?  // Para usuarios no autenticados

  // Session data
  heygenSessionId       String?
  elevenLabsConversationId String?
  startTime             DateTime @default(now())
  endTime               DateTime?
  durationSeconds       Int?

  // Device & Browser
  deviceType            String   // "mobile" | "desktop"
  browser               String?
  os                    String?
  userAgent             String?

  // Quality metrics
  interruptions         Int      @default(0)
  messageCount          Int      @default(0)
  avgResponseTimeMs     Int?

  // Status
  status                String   // "active" | "completed" | "error" | "timeout"
  errorCount            Int      @default(0)

  // Metadata
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  // Relations
  errors                Error[]

  @@index([customerId])
  @@index([startTime])
  @@index([status])
}

// ============================================
// ERROR TRACKING
// ============================================
model Error {
  id              String   @id @default(cuid())

  // Error details
  type            String   // "api_error" | "client_error" | "timeout" etc.
  message         String
  stackTrace      String?  @db.Text

  // Context
  sessionId       String?
  session         Session? @relation(fields: [sessionId], references: [id])
  customerId      String?
  url             String?
  userAgent       String?
  context         Json?    // Additional metadata

  // Metadata
  timestamp       DateTime @default(now())

  @@index([type])
  @@index([sessionId])
  @@index([timestamp])
}

// ============================================
// FEATURE FLAGS
// ============================================
model FeatureFlag {
  id                  String   @id @default(cuid())
  name                String   @unique
  description         String?
  enabled             Boolean  @default(false)
  rolloutPercentage   Int      @default(0) // 0-100

  // Targeting
  targetEmails        String[] // Lista de emails con acceso

  // Metadata
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  @@index([name])
}

// ============================================
// RATE LIMIT COUNTERS (respaldo a Redis)
// ============================================
model RateLimitCounter {
  id              String   @id @default(cuid())
  key             String   @unique // "ip:192.168.1.1" | "user:abc123"
  count           Int      @default(0)
  windowStart     DateTime @default(now())
  expiresAt       DateTime

  @@index([key])
  @@index([expiresAt])
}
```

---

## 4. SERVICIOS / HELPERS

### Ubicación: `apps/demo/src/lib/db/` (nuevo directorio)

#### A. `prisma.ts` - Cliente singleton

```typescript
// apps/demo/src/lib/db/prisma.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

#### B. `customer.service.ts` - CRUD para customers

```typescript
// apps/demo/src/lib/db/customer.service.ts
import { prisma } from "./prisma";

export class CustomerService {
  // Obtener customer (con cache de 5 min)
  static async getOrCreate(shopifyId: string, data: CustomerData) {
    const existing = await prisma.customer.findUnique({
      where: { shopifyId },
    });

    // Si existe y cache es reciente (<5 min), usar cache
    if (
      existing &&
      Date.now() - existing.lastSyncedAt.getTime() < 5 * 60 * 1000
    ) {
      return existing;
    }

    // Si no, actualizar/crear desde Shopify
    return prisma.customer.upsert({
      where: { shopifyId },
      create: { ...data, shopifyId },
      update: { ...data, lastSyncedAt: new Date() },
    });
  }

  // Buscar por email
  static async findByEmail(email: string) {
    return prisma.customer.findUnique({ where: { email } });
  }
}
```

#### C. `session.service.ts` - Analytics de sessions

```typescript
// apps/demo/src/lib/db/session.service.ts
import { prisma } from "./prisma";

export class SessionService {
  // Crear session
  static async create(data: CreateSessionInput) {
    return prisma.session.create({ data });
  }

  // Actualizar session (agregar métricas)
  static async update(sessionId: string, data: Partial<Session>) {
    return prisma.session.update({
      where: { id: sessionId },
      data,
    });
  }

  // Finalizar session
  static async end(sessionId: string) {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    const duration = Math.floor(
      (Date.now() - session.startTime.getTime()) / 1000,
    );

    return prisma.session.update({
      where: { id: sessionId },
      data: {
        endTime: new Date(),
        durationSeconds: duration,
        status: "completed",
      },
    });
  }

  // Analytics query
  static async getStats(timeRange: "day" | "week" | "month") {
    const startDate = new Date();
    if (timeRange === "day") startDate.setDate(startDate.getDate() - 1);
    else if (timeRange === "week") startDate.setDate(startDate.getDate() - 7);
    else startDate.setMonth(startDate.getMonth() - 1);

    const sessions = await prisma.session.findMany({
      where: { startTime: { gte: startDate } },
    });

    return {
      total: sessions.length,
      avgDuration:
        sessions.reduce((acc, s) => acc + (s.durationSeconds || 0), 0) /
        sessions.length,
      completed: sessions.filter((s) => s.status === "completed").length,
      errors: sessions.filter((s) => s.errorCount > 0).length,
    };
  }
}
```

#### D. `error.service.ts` - Error tracking

```typescript
// apps/demo/src/lib/db/error.service.ts
import { prisma } from "./prisma";

export class ErrorService {
  static async log(error: {
    type: string;
    message: string;
    stackTrace?: string;
    sessionId?: string;
    customerId?: string;
    context?: any;
  }) {
    return prisma.error.create({ data: error });
  }

  // Get recent errors (para admin dashboard)
  static async getRecent(limit = 50) {
    return prisma.error.findMany({
      take: limit,
      orderBy: { timestamp: "desc" },
      include: { session: true },
    });
  }
}
```

#### E. `feature-flags.service.ts` - Feature toggles

```typescript
// apps/demo/src/lib/db/feature-flags.service.ts
import { prisma } from "./prisma";

export class FeatureFlagService {
  static async isEnabled(
    flagName: string,
    userEmail?: string,
  ): Promise<boolean> {
    const flag = await prisma.featureFlag.findUnique({
      where: { name: flagName },
    });

    if (!flag) return false;
    if (!flag.enabled) return false;

    // Targeted rollout por email
    if (flag.targetEmails.length > 0) {
      return userEmail ? flag.targetEmails.includes(userEmail) : false;
    }

    // Percentage-based rollout
    if (flag.rolloutPercentage < 100) {
      const hash = userEmail ? hashString(userEmail) : Math.random() * 100;
      return hash < flag.rolloutPercentage;
    }

    return true;
  }

  // Admin: Toggle flag
  static async toggle(flagName: string, enabled: boolean) {
    return prisma.featureFlag.update({
      where: { name: flagName },
      data: { enabled },
    });
  }
}
```

---

## 5. INTEGRACIÓN EN API ROUTES

### Ejemplo: Cache de Shopify customer

#### Antes (sin DB):

```typescript
// apps/demo/app/api/verify-customer/route.ts
export async function POST(request: Request) {
  const { email } = await request.json();

  // ❌ SIEMPRE golpea Shopify API (rate limits)
  const shopifyData = await shopifyClient.getCustomerByEmail(email);

  return Response.json({ customer: shopifyData });
}
```

#### Después (con DB cache):

```typescript
// apps/demo/app/api/verify-customer/route.ts
import { CustomerService } from "@/lib/db/customer.service";

export async function POST(request: Request) {
  const { email } = await request.json();

  // ✅ Primero buscar en cache
  let customer = await CustomerService.findByEmail(email);

  // Si cache está desactualizado (>5 min), refrescar
  if (!customer || isCacheStale(customer.lastSyncedAt)) {
    const shopifyData = await shopifyClient.getCustomerByEmail(email);
    customer = await CustomerService.getOrCreate(shopifyData.id, shopifyData);
  }

  return Response.json({ customer });
}
```

**Beneficio:** Reducir 90% de requests a Shopify API

---

## 6. IMPLEMENTACIÓN PASO A PASO

### Sprint 1: Setup & Schema (1-2 días)

#### 1. Instalar dependencias

```bash
cd apps/demo
pnpm add prisma @prisma/client
pnpm add -D prisma
```

#### 2. Inicializar Prisma

```bash
npx prisma init
```

#### 3. Configurar Vercel Postgres

- Ir a Vercel dashboard → Storage → Create → Postgres
- Copiar env vars a `.env.local`:
  ```
  POSTGRES_URL="..."
  POSTGRES_URL_NON_POOLING="..."
  ```

#### 4. Crear schema

- Copiar schema completo a `prisma/schema.prisma`

#### 5. Migrate

```bash
npx prisma migrate dev --name init
npx prisma generate
```

#### 6. Seed inicial (opcional)

```typescript
// prisma/seed.ts
import { prisma } from "../src/lib/db/prisma";

async function main() {
  // Feature flags por defecto
  await prisma.featureFlag.createMany({
    data: [
      { name: "mobile_support", enabled: true },
      { name: "session_limit", enabled: true },
      { name: "analytics_tracking", enabled: true },
    ],
  });
}

main();
```

---

### Sprint 2: Services & API Integration (2-3 días)

#### 1. Crear servicios

- `lib/db/prisma.ts`
- `lib/db/customer.service.ts`
- `lib/db/session.service.ts`
- `lib/db/error.service.ts`
- `lib/db/feature-flags.service.ts`

#### 2. Integrar en API routes

- `api/verify-customer/route.ts` - usar CustomerService
- `api/start-custom-session/route.ts` - crear Session
- `api/shopify-customer/route.ts` - usar cache

#### 3. Agregar error logging

```typescript
// En cada API route catch block:
catch (error) {
  await ErrorService.log({
    type: 'api_error',
    message: error.message,
    stackTrace: error.stack,
    context: { route: '/api/start-session' }
  })
  throw error
}
```

---

### Sprint 3: Analytics & Feature Flags (1-2 días)

#### 1. Track sessions

```typescript
// En ClaraVoiceAgent.tsx
useEffect(() => {
  if (sessionToken) {
    // Crear session en DB
    SessionService.create({
      deviceType: isDesktop ? "desktop" : "mobile",
      browser: navigator.userAgent,
      status: "active",
    }).then((session) => {
      setDbSessionId(session.id);
    });
  }

  return () => {
    // Al desmontar, finalizar session
    if (dbSessionId) {
      SessionService.end(dbSessionId);
    }
  };
}, [sessionToken]);
```

#### 2. Usar feature flags

```typescript
// En componentes
const isMobileEnabled = await FeatureFlagService.isEnabled(
  'mobile_support',
  session?.user?.email
)

if (!isMobileEnabled) {
  return <MobileNotSupportedScreen />
}
```

---

## 7. ADMIN DASHBOARD (Opcional - Sprint 4)

### Ubicación: `apps/demo/app/admin/page.tsx` (protegido con auth)

**Features:**

- Ver stats de sessions (gráficos)
- Listado de errores recientes
- Toggle feature flags
- Ver customers en cache

**Stack:**

- shadcn/ui charts
- Recharts para gráficos
- Server Components para queries

---

## 8. TESTING

### Checklist

- [ ] Schema migrations funcionan
- [ ] Customer cache reduce requests a Shopify >80%
- [ ] Sessions se trackean correctamente
- [ ] Errors se loggean con stack traces
- [ ] Feature flags funcionan (enable/disable)
- [ ] No hay memory leaks en Prisma client

---

## 9. MONITOREO & MANTENIMIENTO

### Alertas a configurar

- Storage usage >200MB (quedan 56MB)
- Compute hours >50h/month
- Error rate >5%
- Cache hit rate <80%

### Limpieza automática (Cron job)

```typescript
// app/api/cron/cleanup/route.ts
// Ejecutar diario con Vercel Cron
export async function GET() {
  // Borrar errors >30 días
  await prisma.error.deleteMany({
    where: {
      timestamp: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    },
  });

  // Borrar sessions completed >90 días
  await prisma.session.deleteMany({
    where: {
      status: "completed",
      endTime: { lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
    },
  });

  return Response.json({ success: true });
}
```

---

## 10. COSTOS & LÍMITES

### Vercel Postgres Hobby (GRATIS)

- **Storage:** 256MB (~50K sessions) ✅
- **Compute:** 60h/month (renovable) ✅
- **Requests:** Ilimitados ✅

### Estimación de uso

- 100 sessions/día × 1KB = 100KB/día
- 30 días = 3MB/mes
- **Duración estimada:** 85 meses (~7 años) antes de llenar storage

### Plan de upgrade (si crece)

- Vercel Pro ($20/mes): 512MB storage + 100h compute
- PostgreSQL directo (Railway/Render): desde $5/mes

---

## 11. RIESGOS & MITIGACIÓN

| Riesgo                    | Probabilidad | Mitigación                     |
| ------------------------- | ------------ | ------------------------------ |
| Exceder storage 256MB     | Baja         | Cron job de limpieza + alertas |
| Queries lentas            | Media        | Indexes en schema + caching    |
| Prisma client memory leak | Baja         | Singleton pattern + monitoring |
| Migration failure en prod | Baja         | Test en staging primero        |

---

## 12. SIGUIENTE PASO

**Acción requerida:** Aprobar para crear Vercel Postgres database.

**Orden de implementación:**

1. Sprint 1: Setup (crítico)
2. Sprint 2: Cache de Shopify (alto impacto)
3. Sprint 3: Analytics (nice to have)
4. Sprint 4: Admin dashboard (opcional)

**¿Proceder con Sprint 1?**
