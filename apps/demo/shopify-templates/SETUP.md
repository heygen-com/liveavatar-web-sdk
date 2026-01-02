# Shopify Integration Setup

## Resumen

Clara se integra con Shopify mediante un iframe que recibe datos del cliente autenticado.
La seguridad se garantiza con HMAC-SHA256 para evitar suplantación de identidad.

## Arquitectura

```
┌─────────────────────────────────────────────────────────────────────┐
│  SHOPIFY (Liquid Template)                                          │
│                                                                     │
│  1. Cliente visita /pages/clara                                     │
│  2. Liquid detecta si está logueado (customer object)               │
│  3. Genera HMAC: customer_id | hmac_sha256: secret                  │
│  4. Construye URL con params                                        │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  URL GENERADA                                                       │
│                                                                     │
│  https://clara.betaskintech.com/                                    │
│    ?customer_id=12345678                                            │
│    &shopify_token=a1b2c3d4e5f6...                                   │
│    &first_name=María                                                │
│    &last_name=González                                              │
│    &email=maria@ejemplo.com                                         │
│    &orders_count=3                                                  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  CLARA (Next.js)                                                    │
│                                                                     │
│  1. page.tsx detecta shopify_token en URL                           │
│  2. Llama a /api/shopify-customer con los params                    │
│  3. API valida HMAC (timing-safe comparison)                        │
│  4. API verifica orders > 0                                         │
│  5. Si válido → muestra Clara personalizada                         │
│  6. Si inválido → muestra error                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Configuración

### 1. Generar HMAC Secret

```bash
openssl rand -hex 32
```

Ejemplo de output:

```
6d0a5094b3037442558d61e6999098eff58334eb17dd0a27f2e4890374046143
```

### 2. Configurar Metafield en Shopify

1. Ve a **Settings → Custom data → Store**
2. Click **Add definition**
3. Configurar:
   - **Namespace and key**: `custom.hmac_secret`
   - **Type**: Single line text
   - **Value**: El secreto generado en paso 1

### 3. Configurar Variables en Vercel

En **Project Settings → Environment Variables**:

| Variable                     | Valor                        | Nota                          |
| ---------------------------- | ---------------------------- | ----------------------------- |
| `SHOPIFY_STORE_DOMAIN`       | `betaskintech.myshopify.com` | Sin https://                  |
| `SHOPIFY_ADMIN_ACCESS_TOKEN` | `shpat_xxxxx`                | De tu app privada             |
| `SHOPIFY_HMAC_SECRET`        | `6d0a5094b3037...`           | **Mismo valor que metafield** |

### 4. Crear Template en Shopify

1. Ve a **Online Store → Themes → Edit code**
2. En **Templates**, click **Add a new template**
3. Seleccionar:
   - Type: `page`
   - Name: `clara`
4. Copiar contenido de `page.clara.liquid`
5. Guardar

### 5. Crear Página

1. Ve a **Online Store → Pages → Add page**
2. Configurar:
   - **Title**: Clara - Asesora Virtual
   - **Template**: page.clara
   - **Handle**: clara (URL será /pages/clara)
3. Guardar

## URLs por Ambiente

| Ambiente       | Clara URL                | Shopify URL                      | Template                                          |
| -------------- | ------------------------ | -------------------------------- | ------------------------------------------------- |
| **Production** | clara.betaskintech.com   | betaskintech.cl/pages/clara      | `clara_domain = 'https://clara.betaskintech.com'` |
| **Testing**    | testers.betaskintech.com | betaskintech.cl/pages/clara-test | Cambiar `clara_domain` en template                |

## Flujos de Usuario

### Flujo A: Desde Shopify (cliente logueado)

```
1. Cliente entra a betaskintech.cl/pages/clara
2. Shopify detecta sesión activa
3. Liquid genera URL con token HMAC
4. Clara valida token y muestra agente personalizado
   → "¡Hola María! Veo que ya has comprado con nosotros..."
```

### Flujo B: Desde Shopify (anónimo)

```
1. Visitante entra a betaskintech.cl/pages/clara
2. Shopify no tiene sesión
3. URL sin token: clara.betaskintech.com/
4. Clara muestra pantalla de verificación
   → "Ingresa tu email de compra para continuar"
```

### Flujo C: Acceso directo

```
1. Usuario entra directamente a clara.betaskintech.com
2. Sin params de Shopify
3. Clara muestra login
   → Google Sign In o verificación por email
```

## Seguridad

### HMAC Validation

El token se genera así en Liquid:

```liquid
assign shopify_token = customer_id | hmac_sha256: hmac_secret
```

Clara lo valida así:

```typescript
const expected = crypto
  .createHmac("sha256", SHOPIFY_HMAC_SECRET)
  .update(customer_id)
  .digest("hex");

// Timing-safe comparison
crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
```

### Por qué es seguro

1. **Sin secreto, no hay token válido**: Solo Shopify y Clara conocen el secreto
2. **Timing-safe**: Previene ataques de timing para adivinar el token
3. **Por request**: Cada URL tiene token único basado en customer_id
4. **No expira**: Pero solo funciona para ese customer_id específico

## Troubleshooting

### Token inválido (401)

- Verificar que `SHOPIFY_HMAC_SECRET` en Vercel = `shop.metafields.custom.hmac_secret`
- El secreto debe ser idéntico, sin espacios extra

### Customer not found (404)

- Verificar `SHOPIFY_STORE_DOMAIN` correcto
- Verificar `SHOPIFY_ADMIN_ACCESS_TOKEN` tiene permisos de read_customers

### Service not configured (503)

- Faltan variables de entorno en Vercel
- Hacer redeploy después de agregar variables

### Iframe no carga

- Verificar que el dominio permite ser embebido
- Revisar consola del navegador para errores CORS
