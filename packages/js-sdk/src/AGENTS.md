# AGENTS.md

Guidance for humans and coding agents working on the `@heygen/liveavatar-web-sdk` source in this directory. Everything here is public API surface.

Before opening a PR, run from `packages/js-sdk`:

```sh
pnpm vitest run
pnpm lint
npx tsc --noEmit -p .
```

When the public API changes, also typecheck `apps/demo`, which consumes this package.

## Public config design

These rules apply to `SessionConfig`, `VoiceChatConfig`, and any future config interface exposed to SDK consumers.

### One shape per field

Every config field has exactly one type. Do not use union types such as `boolean | SomeConfig` to offer a shorthand.

- A feature with no options is a plain `boolean` that defaults to `false`. Example: `autoKeepAlive?: boolean`.
- A feature with options is an optional object with a documented default applied when omitted. Example: `voiceChat?: VoiceChatConfig` defaults to `{}`, microphone on.
- Never add a `false` or `true` spelling for an object field. Turning a feature down or off is expressed by an option inside the object, such as `voiceChat: { defaultMuted: true }`.

Why: unions force every consumer, including our own code, to type-narrow before reading a field, they are harder to document, and they grow badly when a third option appears. `voiceChat: true | false | VoiceChatConfig` was removed in 0.0.19 for these reasons.

### Alphabetical field order

Fields inside a config interface are ordered alphabetically. Add new fields in their sorted position, not at the end.

### Document every field

Each field gets a JSDoc comment stating what it does and its default when omitted.

### Deprecations

When a config field changes shape, keep a runtime shim for at least one release that accepts the old value, logs a `console.warn` naming the deprecated form and its replacement, and maps it to the new form. The TypeScript type moves to the new shape immediately. See `normalizeSessionConfig` in `LiveAvatarSession/LiveAvatarSession.ts`.

## Async methods

Public `async` methods await the underlying API call and let rejections propagate. Callers decide whether to await. Internal timers or fire-and-forget callers must attach a `.catch` so failures are logged instead of surfacing as unhandled rejections.
