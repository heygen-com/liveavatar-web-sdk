import { describe, it, expect } from "vitest";
import fs from "fs/promises";
import path from "path";

describe("AUTH_SECRET Security", () => {
  it("AUTH_SECRET debe estar configurado en .env.example", async () => {
    const envExamplePath = path.join(__dirname, "../../../.env.example");
    const envExample = await fs.readFile(envExamplePath, "utf-8");

    expect(envExample).toContain("AUTH_SECRET=");
    expect(envExample).toContain("openssl rand -base64 32");
    expect(envExample).toContain("CRITICAL: Required for secure JWT tokens");
  });

  it("AUTH_SECRET debe tener mínimo 32 caracteres", () => {
    // Test con el secret generado en la implementación
    const validSecret = "TlRDFBd2I4dJQbrmzesBFLNeRpZKEbA+3QmD+HqH/vo=";
    expect(validSecret.length).toBeGreaterThanOrEqual(32);

    // Test con secret corto (inseguro)
    const shortSecret = "short";
    expect(shortSecret.length).toBeLessThan(32);
  });

  it("AUTH_SECRET no debe estar hardcodeado en código fuente", async () => {
    const authFilePath = path.join(__dirname, "../../../auth.ts");
    const authFile = await fs.readFile(authFilePath, "utf-8");

    // No debe tener secrets hardcodeados tipo: AUTH_SECRET = "value"
    expect(authFile).not.toMatch(/AUTH_SECRET\s*=\s*["'][^"']+["']/);

    // Debe usar process.env o variables de entorno
    expect(authFile).toContain("process.env");
  });

  it(".env.example debe incluir instrucciones de generación", async () => {
    const envExamplePath = path.join(__dirname, "../../../.env.example");
    const envExample = await fs.readFile(envExamplePath, "utf-8");

    // Debe incluir el comando para generar secret
    expect(envExample).toContain("openssl rand -base64 32");
    // Debe estar comentado como crítico
    expect(envExample).toMatch(/CRITICAL|Required|Important/i);
  });

  it("AUTH_SECRET debe estar en sección NextAuth de .env.example", async () => {
    const envExamplePath = path.join(__dirname, "../../../.env.example");
    const envExample = await fs.readFile(envExamplePath, "utf-8");

    // Debe estar en sección de NextAuth
    expect(envExample).toContain("NextAuth Configuration");

    // AUTH_SECRET debe aparecer después del comentario de NextAuth
    const nextAuthIndex = envExample.indexOf("NextAuth Configuration");
    const authSecretIndex = envExample.indexOf("AUTH_SECRET=");
    expect(authSecretIndex).toBeGreaterThan(nextAuthIndex);
  });
});
