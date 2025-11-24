import { vi } from "vitest";
import { API_URL } from "../../const";

type MockCfg = {
  url: string;
  method?: string;
  response?: unknown;
  status?: number;
  headers?: Record<string, string>;
};

function matchUrl(target: string, pattern: string): boolean {
  if (pattern.startsWith("http")) {
    return target === pattern;
  }
  return target === `${API_URL}${pattern}`;
}

export function mockFetch(...configs: MockCfg[]) {
  const spy = vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(
      async (input: string | URL | globalThis.Request, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        const method = (init?.method || "GET").toUpperCase();

        const cfg = configs.find(
          (c) =>
            matchUrl(url, c.url) &&
            (c.method ? c.method.toUpperCase() === method : method === "GET"),
        );
        if (!cfg) {
          return Promise.reject(new Error(`Unhandled fetch: ${method} ${url}`));
        }

        const body =
          cfg.response === undefined ? null : JSON.stringify(cfg.response);
        const res = new Response(body, {
          status: cfg.status ?? 200,
          headers: {
            "content-type": "application/json",
            ...(cfg.headers || {}),
          },
        });

        return res;
      },
    );

  return () => spy.mockRestore();
}
