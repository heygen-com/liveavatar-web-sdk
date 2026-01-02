/** @type {import('next').NextConfig} */
const nextConfig = {
  // Transpile internal workspace packages
  transpilePackages: ["@heygen/liveavatar-web-sdk"],
  // Turbopack config for module resolution
  turbopack: {
    resolveAlias: {
      // Polyfill for Node.js events module
      events: "events",
      // Direct alias to SDK build output (fixes Vercel workspace resolution)
      "@heygen/liveavatar-web-sdk": "../../packages/js-sdk/lib/index.esm.js",
    },
  },
  async headers() {
    return [
      {
        // Apply to all routes
        source: "/:path*",
        headers: [
          // Content Security Policy - Allow HeyGen, ElevenLabs, OpenAI, LiveKit
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://*.heygen.com https://*.liveavatar.com https://*.livekit.cloud",
              "media-src 'self' blob: https://*.heygen.com https://*.liveavatar.com wss://*.livekit.cloud",
              "connect-src 'self' https://*.heygen.com https://*.liveavatar.com https://api.elevenlabs.io wss://*.elevenlabs.io https://api.openai.com https://*.livekit.cloud wss://*.livekit.cloud wss://*.heygen.io https://*.heygen.io",
              // Allow embedding from Shopify (myshopify.com, shopify.com) and custom domain (betaskintech.com)
              "frame-ancestors 'self' https://*.myshopify.com https://*.shopify.com https://admin.shopify.com https://betaskintech.com https://*.betaskintech.com http://localhost:*",
              "worker-src 'self' blob:",
            ].join("; "),
          },
          // Permissions Policy for microphone access in iframes
          {
            key: "Permissions-Policy",
            value:
              'microphone=(self "https://*.myshopify.com" "https://*.shopify.com" "https://betaskintech.com")',
          },
          // X-Frame-Options removed - CSP frame-ancestors takes precedence
          // Some browsers need this for compatibility
        ],
      },
    ];
  },
};

export default nextConfig;
