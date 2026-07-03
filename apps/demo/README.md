# LiveAvatar Basic Demo

Minimal reference app for the LiveAvatar Web SDK. Spins up a session, renders the avatar
video stream, and wires up voice chat. Use this as the starting point for your own
integration — no extra effects or transforms on top.

For background swapping / chroma key, see [`apps/bg-removal-demo`](../bg-removal-demo).

## Stack

Next.js, TailwindCSS, pnpm.

## Configuration

Copy the example env file and set your LiveAvatar API key:

```bash
cp .env.example .env.local
```

| Variable              | Required | Default                      | Description                                                       |
| --------------------- | -------- | ---------------------------- | ----------------------------------------------------------------- |
| `API_KEY`             | Yes      | —                            | Your LiveAvatar API key (server-side only, never sent to browser) |
| `API_URL`             | No       | `https://api.liveavatar.com` | LiveAvatar API base URL (server-side)                             |
| `NEXT_PUBLIC_API_URL` | No       | `https://api.liveavatar.com` | API base URL used by the client-side SDK                          |
| `IS_SANDBOX`          | No       | `true`                       | Set to `false` only if you have a production API key              |
| `DEFAULT_AVATAR_ID`   | No       | built-in demo avatar         | Avatar used for FULL mode sessions                                |
| `DEFAULT_VOICE_ID`    | No       | built-in demo voice          | Voice used for FULL mode sessions                                 |
| `DEFAULT_CONTEXT_ID`  | No       | built-in demo context        | Context used for FULL mode sessions                               |
| `DEFAULT_LANGUAGE`    | No       | `en`                         | Session language                                                  |
| `ELEVENLABS_API_KEY`  | No       | —                            | Only for LITE mode / ElevenLabs agent flows                       |
| `OPENAI_API_KEY`      | No       | —                            | Only for LITE mode chat completion                                |

Sandbox mode is on by default. If starting a session fails with an authorization or
plan-related error, try `IS_SANDBOX=false` (production keys) or vice versa.

## Run

From the monorepo root:

```bash
pnpm install
pnpm demo
```

Or from this directory:

```bash
pnpm install
pnpm dev
```

Open <http://localhost:3001>.

## Deploy to Vercel

This app lives in a pnpm/Turborepo monorepo and depends on the workspace package
`@heygen/liveavatar-web-sdk`, which must be built before `next build`. The committed
`vercel.json` pins the correct build command (`pnpm turbo run build --filter=demo`),
so Turborepo builds the SDK first.

1. Push your fork to GitHub.
2. On [vercel.com](https://vercel.com), choose **Add New… → Project** and import your fork.
3. Set **Root Directory** to `apps/demo`. Keep "Include source files outside of the
   Root Directory" enabled (it's the default) so the workspace SDK is available.
4. Framework preset should auto-detect as Next.js; the build command comes from
   `vercel.json`. Use Node.js 22.x (the repo requires Node >= 22).
5. Add environment variables:
   - `API_KEY` — your LiveAvatar API key (required)
   - `NEXT_PUBLIC_API_URL` — `https://api.liveavatar.com`
   - `IS_SANDBOX` — `true` (default) or `false` for production keys
6. Deploy.

If a session fails after deploying, check the Vercel function logs for the
`/api/start-session` route — missing or invalid env vars surface there.
