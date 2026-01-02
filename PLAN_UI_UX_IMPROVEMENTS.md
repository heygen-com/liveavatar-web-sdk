# Plan de Mejoras UI/UX - Clara Voice Agent

**Fecha:** 2026-01-02
**Estado:** Pendiente aprobación
**Responsable UI/UX:** Este plan (tú delegas audio)

---

## 1. ANÁLISIS DEL ESTADO ACTUAL

### Fortalezas Existentes ✅

- Diseño iOS-style con glassmorphism bien implementado
- shadcn/ui components (moderno, accesible)
- Esquema monocromático limpio y profesional
- Responsive mobile/desktop funcional
- Animaciones básicas (pulse, bounce, voice-wave)

### Áreas de Mejora Identificadas 🎯

#### A. **Estados de Carga y Transiciones**

- Loading states genéricos (solo spinners)
- Transiciones bruscas entre pantallas
- Falta feedback visual durante operaciones

#### B. **Flujo de Verificación de Cliente**

- Múltiples pantallas de verificación confusas
- Mensajes de error poco claros
- No hay guía visual del progreso

#### C. **Experiencia Durante Sesión**

- Warnings de expiración son abruptos
- No hay indicador visual de tiempo restante
- Calidad de conexión poco visible

#### D. **Manejo de Errores**

- Errores mostrados en banners genéricos
- No hay acciones sugeridas para resolver
- Falta de categorización de errores

#### E. **Accesibilidad**

- Falta ARIA labels en componentes interactivos
- Contraste de colores no verificado (WCAG AA)
- Navegación por teclado no optimizada

---

## 2. MEJORAS PROPUESTAS

### 🎨 **Fase 1: Polish Visual & Microinteracciones**

#### 1.1 Skeleton Loaders Inteligentes

**Ubicación:** `apps/demo/src/components/ui/skeleton-loader.tsx` (nuevo)

```typescript
// Reemplazar spinners genéricos con skeleton screens
- ConnectingScreen: Skeleton del avatar
- CustomerVerification: Skeleton del form
- LandingScreen: Skeleton del card
```

**Beneficio:** Reduce percepción de tiempo de carga 30-40%

#### 1.2 Transiciones de Pantalla Suaves

**Ubicación:** `apps/demo/app/globals.css`

```css
/* Agregar page transitions con Framer Motion o CSS */
.page-transition-enter {
  opacity: 0;
  transform: translateY(20px);
}
.page-transition-enter-active {
  opacity: 1;
  transform: translateY(0);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
```

**Ubicaciones a aplicar:**

- `page.tsx` (todas las pantallas de estado)
- `ClaraVoiceAgent.tsx` (cambios de widget state)

#### 1.3 Feedback Visual Mejorado

**Ubicación:** `apps/demo/src/components/ClaraVoiceAgent.tsx`

- **Botones:** Agregar ripple effect al click
- **Status badges:** Mejorar animaciones de transición
- **Mute button:** Feedback táctil (vibración en mobile)

---

### 📱 **Fase 2: Optimización de Flujos**

#### 2.1 Rediseño de Flujo de Verificación

**Ubicación:** `apps/demo/src/components/CustomerVerification.tsx`

**Mejoras:**

1. **Progress stepper visual:**

   ```
   [1. Email] → [2. Verificando] → [3. Listo]
   ```

2. **Estados mejorados:**
   - Validación inline de email (mientras escribe)
   - Loading state específico por paso
   - Success animations al completar

3. **Error recovery:**
   - Sugerencias contextuales ("¿Usaste otro email?")
   - Botón "Probar otro email" sin recargar
   - Link a soporte si falla 3 veces

#### 2.2 Indicador de Tiempo de Sesión

**Ubicación:** `apps/demo/src/components/SessionTimer.tsx` (nuevo)

```typescript
// Barra de progreso circular sutil
- Verde: >5 min restantes
- Amarillo: 2-5 min
- Rojo: <2 min (+ warning)
- Animación smooth de cuenta regresiva
```

**Ubicación en UI:** Top-right, junto a UserMenu

#### 2.3 Calidad de Conexión Visible

**Ubicación:** `apps/demo/src/components/ClaraVoiceAgent.tsx`

```typescript
// Status indicator mejorado con tooltips
- Excellent (verde): <100ms latency
- Good (amarillo): 100-300ms
- Poor (rojo): >300ms
- Tooltip: "Latencia: 120ms" (on hover)
```

---

### 🎯 **Fase 3: UX de Error Handling**

#### 3.1 Sistema de Notificaciones Toast

**Ubicación:** `apps/demo/src/components/ui/toast.tsx` (nuevo, usar sonner)

**Categorías:**

- **Success:** Verde, checkmark, auto-dismiss 3s
- **Warning:** Amarillo, alert icon, auto-dismiss 5s
- **Error:** Rojo, X icon, requiere dismiss manual
- **Info:** Azul, info icon, auto-dismiss 4s

**Reemplazar:**

- Todos los `<div className="bg-red-100">` por toasts
- Agregar acciones: "Reintentar", "Ver detalles", "Reportar"

#### 3.2 Error Boundaries con Recovery

**Ubicación:** `apps/demo/src/components/ErrorBoundary.tsx` (nuevo)

```typescript
// Capturar errores de React con UI de recovery
- Pantalla de error amigable
- Botón "Reiniciar sesión"
- Opción "Reportar problema" (envía logs)
- Fallback por tipo de error
```

#### 3.3 Mensajes de Error Contextuales

**Ubicación:** `apps/demo/src/lib/error-messages.ts` (nuevo)

```typescript
// Mapeo de errores técnicos → mensajes amigables
{
  "Failed to start session": {
    user: "No pudimos conectar con Clara. Intenta de nuevo.",
    action: "Reintentar",
    support: "Si persiste, contacta soporte"
  },
  "Unauthorized": {
    user: "Tu sesión expiró. Inicia sesión nuevamente.",
    action: "Ir a login",
    support: null
  }
}
```

---

### ♿ **Fase 4: Accesibilidad (WCAG AA)**

#### 4.1 Navegación por Teclado

**Ubicaciones múltiples:**

```typescript
// Agregar focus management
- Tab order lógico en todos los forms
- Focus visible en botones (outline claro)
- Escape key para cerrar modals
- Enter key para submit en forms
```

#### 4.2 ARIA Labels Completos

**Ubicación:** Todos los componentes interactivos

```typescript
// Ejemplos
<Button aria-label="Iniciar conversación con Clara">
<StatusBadge role="status" aria-live="polite">
<MuteButton aria-pressed={isMuted}>
```

#### 4.3 Contraste de Colores

**Ubicación:** `apps/demo/app/globals.css`

**Auditoría y ajuste:**

- Verificar todos los text/bg con herramienta de contraste
- Ajustar grises si ratio < 4.5:1 (texto normal)
- Ajustar status badges si ratio < 3:1 (texto grande)

#### 4.4 Reducción de Movimiento

**Ubicación:** `apps/demo/app/globals.css`

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

### 🎭 **Fase 5: Branding & Polish Final**

#### 5.1 Personalización de Marca

**Ubicaciones:**

- `apps/demo/app/globals.css` - Agregar CSS variables de marca
- `apps/demo/tailwind.config.cjs` - Extend con colores de BetaSkintech

```typescript
// Colores de marca (placeholder - ajustar según branding real)
colors: {
  brand: {
    primary: '#...',
    secondary: '#...',
    accent: '#...'
  }
}
```

#### 5.2 Animaciones de Entrada Personalizadas

**Ubicación:** `apps/demo/src/components/ClaraVoiceAgent.tsx`

- Avatar aparece con fade-in + scale
- Landing screen con stagger de elementos
- Status badges con bounce al cambiar estado

#### 5.3 Empty States & Placeholders

**Ubicación:** Nuevos componentes según necesidad

- Estado cuando no hay customer data
- Estado cuando falla carga de Shopify
- Estado cuando sesión se desconecta

---

## 3. PRIORIZACIÓN

### 🚀 **Alta Prioridad (Sprint 1)**

1. Skeleton loaders (1.1) - 2 días
2. Toast notifications (3.1) - 1 día
3. Error messages contextuales (3.3) - 1 día
4. Session timer indicator (2.2) - 1 día

**Total Sprint 1:** ~5 días

### 📊 **Media Prioridad (Sprint 2)**

1. Flujo de verificación rediseñado (2.1) - 3 días
2. Transiciones de pantalla (1.2) - 2 días
3. Error boundaries (3.2) - 2 días
4. ARIA labels (4.2) - 1 día

**Total Sprint 2:** ~8 días

### ⭐ **Baja Prioridad (Sprint 3)**

1. Feedback visual botones (1.3) - 1 día
2. Navegación por teclado (4.1) - 2 días
3. Contraste de colores (4.3) - 1 día
4. Branding personalizado (5.1) - 2 días
5. Animaciones de entrada (5.2) - 1 día

**Total Sprint 3:** ~7 días

---

## 4. MÉTRICAS DE ÉXITO

### KPIs a Trackear

- **Time to Interactive:** Reducir 30% con skeleton loaders
- **Error Recovery Rate:** >80% de usuarios recuperan sin soporte
- **Accessibility Score:** Lighthouse >90
- **User Satisfaction:** Encuesta post-sesión >4.5/5

### Testing Checklist

- [ ] Testing en Chrome, Firefox, Safari (desktop)
- [ ] Testing en iOS Safari, Chrome Mobile
- [ ] Testing con screen reader (NVDA/JAWS)
- [ ] Testing con keyboard-only navigation
- [ ] Testing de contraste de colores (axe DevTools)

---

## 5. DEPENDENCIAS

### Nuevas Librerías

```json
{
  "sonner": "^1.3.1", // Toast notifications
  "framer-motion": "^10.16.16", // Smooth animations (opcional)
  "@radix-ui/react-progress": "^1.0.3", // Session timer
  "@radix-ui/react-toast": "^1.1.5" // Alternativa a sonner
}
```

### No Requiere

- ❌ Backend changes (solo frontend)
- ❌ Database (todo es UI/UX)
- ❌ Breaking changes (backward compatible)

---

## 6. RIESGOS Y MITIGACIÓN

| Riesgo                                 | Probabilidad | Impacto | Mitigación                                 |
| -------------------------------------- | ------------ | ------- | ------------------------------------------ |
| Animaciones afectan performance mobile | Media        | Alto    | Feature detection + prefers-reduced-motion |
| Breaking changes en shadcn/ui          | Baja         | Medio   | Lock versions, test antes de upgrade       |
| Accesibilidad rompe diseño visual      | Baja         | Bajo    | Diseñar con a11y desde inicio              |

---

## 7. SIGUIENTE PASO

**Acción requerida:** Aprobar este plan para comenzar implementación.

**Orden sugerido:**

1. Sprint 1 (Alta prioridad) - Quick wins, impacto inmediato
2. Sprint 2 (Media prioridad) - Mejoras sustanciales
3. Sprint 3 (Baja prioridad) - Polish final

**Pregunta para ti:** ¿Alguna prioridad específica que quieras cambiar? ¿Comenzamos con Sprint 1?
