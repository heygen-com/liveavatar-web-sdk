import { describe, it, expect, beforeEach, vi } from "vitest";
import fs from "fs/promises";
import path from "path";

describe("Auth Bypass Prevention", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("start-custom-session endpoint", () => {
    it("NO debe confiar en headers x-shopify-validated", async () => {
      const routePath = path.join(
        __dirname,
        "../../../app/api/start-custom-session/route.ts",
      );
      const routeCode = await fs.readFile(routePath, "utf-8");

      // NO debe confiar en headers del cliente
      // Este era el código vulnerable: request.headers.get("x-shopify-validated") === "true"
      expect(routeCode).not.toMatch(
        /request\.headers\.get\(["']x-shopify-validated["']\)\s*===\s*["']true["']/,
      );

      // NO debe usar el header en decisiones de auth
      if (routeCode.includes("x-shopify-validated")) {
        // Si el header aparece, debe ser ignorado o comentado
        const lines = routeCode.split("\n");
        const headerLines = lines.filter((line) =>
          line.includes("x-shopify-validated"),
        );
        headerLines.forEach((line) => {
          // Solo debe aparecer en comentarios
          expect(line.trim()).toMatch(/^\/\//);
        });
      }
    });

    it("DEBE usar verifyCustomerToken para validación HMAC", async () => {
      const routePath = path.join(
        __dirname,
        "../../../app/api/start-custom-session/route.ts",
      );
      const routeCode = await fs.readFile(routePath, "utf-8");

      // Debe importar función de verificación
      expect(routeCode).toContain("verifyCustomerToken");

      // Debe validar con HMAC
      expect(routeCode).toMatch(/verifyCustomerToken\s*\(/);

      // Debe recibir customer_id y shopify_token
      expect(routeCode).toContain("shopifyCustomerId");
      expect(routeCode).toContain("shopifyToken");
    });

    it("DEBE parsear credentials del body, NO de headers", async () => {
      const routePath = path.join(
        __dirname,
        "../../../app/api/start-custom-session/route.ts",
      );
      const routeCode = await fs.readFile(routePath, "utf-8");

      // Debe parsear body con request.json()
      expect(routeCode).toContain("request.json()");

      // Debe extraer customer_id y shopify_token del body
      expect(routeCode).toMatch(/body\.customer_id/);
      expect(routeCode).toMatch(/body\.shopify_token/);
    });

    it("DEBE validar customer_id con isValidCustomerId", async () => {
      const routePath = path.join(
        __dirname,
        "../../../app/api/start-custom-session/route.ts",
      );
      const routeCode = await fs.readFile(routePath, "utf-8");

      // Debe importar función de validación
      expect(routeCode).toContain("isValidCustomerId");

      // Debe usar cleanCustomerId para limpiar el ID
      expect(routeCode).toContain("cleanCustomerId");
    });

    it("DEBE retornar 401 con mensaje descriptivo al fallar auth", async () => {
      const routePath = path.join(
        __dirname,
        "../../../app/api/start-custom-session/route.ts",
      );
      const routeCode = await fs.readFile(routePath, "utf-8");

      // Debe retornar 401 Unauthorized
      expect(routeCode).toContain("401");

      // Debe incluir mensaje descriptivo
      expect(routeCode).toMatch(
        /Valid session or Shopify credentials required/,
      );
    });

    it("DEBE loggear intentos de HMAC inválidos", async () => {
      const routePath = path.join(
        __dirname,
        "../../../app/api/start-custom-session/route.ts",
      );
      const routeCode = await fs.readFile(routePath, "utf-8");

      // Debe loggear cuando HMAC es válido
      expect(routeCode).toMatch(/console\.log.*Valid Shopify HMAC/);

      // Debe loggear (warn) cuando HMAC es inválido
      expect(routeCode).toMatch(/console\.warn.*Invalid.*HMAC/);
    });
  });

  describe("elevenlabs-conversation endpoint", () => {
    it("DEBE implementar misma validación HMAC", async () => {
      const routePath = path.join(
        __dirname,
        "../../../app/api/elevenlabs-conversation/route.ts",
      );
      const routeCode = await fs.readFile(routePath, "utf-8");

      // NO debe usar header falsificable
      expect(routeCode).not.toMatch(
        /request\.headers\.get\(["']x-shopify-validated["']\)\s*===\s*["']true["']/,
      );

      // DEBE usar verifyCustomerToken
      expect(routeCode).toContain("verifyCustomerToken");
      expect(routeCode).toContain("shopifyCustomerId");
      expect(routeCode).toContain("shopifyToken");
    });

    it("DEBE parsear credentials del body", async () => {
      const routePath = path.join(
        __dirname,
        "../../../app/api/elevenlabs-conversation/route.ts",
      );
      const routeCode = await fs.readFile(routePath, "utf-8");

      // Debe parsear body
      expect(routeCode).toContain("request.json()");
      expect(routeCode).toMatch(/body\.customer_id/);
      expect(routeCode).toMatch(/body\.shopify_token/);
    });
  });

  describe("HMAC Security Functions", () => {
    it("verifyCustomerToken DEBE usar crypto.timingSafeEqual", async () => {
      const securityPath = path.join(
        __dirname,
        "../../../src/shopify/security.ts",
      );
      const securityCode = await fs.readFile(securityPath, "utf-8");

      // Debe usar timingSafeEqual para prevenir timing attacks
      expect(securityCode).toContain("timingSafeEqual");

      // La función debe existir
      expect(securityCode).toContain("export function verifyCustomerToken");
    });

    it("generateCustomerToken DEBE usar HMAC-SHA256", async () => {
      const securityPath = path.join(
        __dirname,
        "../../../src/shopify/security.ts",
      );
      const securityCode = await fs.readFile(securityPath, "utf-8");

      // Debe usar HMAC con SHA256
      expect(securityCode).toContain("createHmac");
      expect(securityCode).toMatch(/sha256/);

      // Debe usar secret de environment
      expect(securityCode).toContain("SHOPIFY_HMAC_SECRET");
    });

    it("isValidCustomerId DEBE validar formato numérico", async () => {
      const securityPath = path.join(
        __dirname,
        "../../../src/shopify/security.ts",
      );
      const securityCode = await fs.readFile(securityPath, "utf-8");

      // Debe validar que sea numérico
      expect(securityCode).toMatch(/\\d\+/);

      // La función debe existir
      expect(securityCode).toContain("export function isValidCustomerId");
    });

    it("cleanCustomerId DEBE remover prefijo gid://", async () => {
      const securityPath = path.join(
        __dirname,
        "../../../src/shopify/security.ts",
      );
      const securityCode = await fs.readFile(securityPath, "utf-8");

      // Debe remover prefijo gid://shopify/Customer/ (buscar el string con escapes)
      expect(securityCode).toMatch(/gid.*shopify.*Customer/);
      // También verificar que usa replace
      expect(securityCode).toContain("replace");

      // La función debe existir
      expect(securityCode).toContain("export function cleanCustomerId");
    });
  });

  describe("Security Documentation", () => {
    it("SECURITY_TESTING.md debe existir y documentar el fix", async () => {
      const docPath = path.join(__dirname, "../../../SECURITY_TESTING.md");
      const docContent = await fs.readFile(docPath, "utf-8");

      // Debe documentar la vulnerabilidad
      expect(docContent).toContain("Auth Bypass");
      expect(docContent).toContain("CRITICAL");

      // Debe documentar el antes y después
      expect(docContent).toContain("Before Fix");
      expect(docContent).toContain("After Fix");

      // Debe incluir test cases
      expect(docContent).toContain("Test Cases");
      expect(docContent).toContain("curl");

      // Debe documentar HMAC
      expect(docContent).toContain("HMAC");
      expect(docContent).toContain("timingSafeEqual");
    });

    it("SECURITY_TESTING.md debe incluir vectores de ataque", async () => {
      const docPath = path.join(__dirname, "../../../SECURITY_TESTING.md");
      const docContent = await fs.readFile(docPath, "utf-8");

      // Debe documentar el vector de ataque con header
      expect(docContent).toContain("x-shopify-validated");
      expect(docContent).toContain("Attack Vector");

      // Debe incluir ejemplos de curl (usar dotAll flag para multiline)
      expect(docContent).toMatch(/curl[\s\S]*x-shopify-validated/);
      // También verificar que menciona el comando curl
      expect(docContent).toContain("curl -X POST");
    });
  });
});
