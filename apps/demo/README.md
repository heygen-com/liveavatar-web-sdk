# LiveAvatar Basic Demo

Minimal reference app for the LiveAvatar Web SDK. Spins up a session, renders the avatar
video stream, and wires up voice chat. Use this as the starting point for your own
integration — no extra effects or transforms on top.

For background swapping / chroma key, see [`apps/bg-removal-demo`](../bg-removal-demo).

## Stack

Next.js, TailwindCSS, pnpm.

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
