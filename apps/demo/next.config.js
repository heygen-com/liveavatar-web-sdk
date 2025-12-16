/** @type {import('next').NextConfig} */
const nextConfig = {
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
              "frame-ancestors 'self' https://*.myshopify.com https://*.shopify.com https://admin.shopify.com http://localhost:*",
              "worker-src 'self' blob:",
            ].join("; "),
          },
          // Permissions Policy for microphone access in iframes
          {
            key: "Permissions-Policy",
            value:
              'microphone=(self "https://*.myshopify.com" "https://*.shopify.com")',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
