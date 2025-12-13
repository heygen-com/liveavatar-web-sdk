# Liveavatar NextJS Demo

This is a quick demo to demonstrate the various capabilities of the LiveAvatar Web SDK.

## Installation

This demo was built with NextJS, TailwindCSS and pnpm.

To start up the demo, run the following commands on your terminal within the base directory:

```bash
pnpm install
pnpm build
pnpm run demo
```

You can also run navigate to the `apps/demo` directory and run the following commands:

```bash
pnpm install
pnpm build
pnpm run dev
```

Navigate to the local demo page on [http://localhost:3000](http://localhost:3000).

## Configuration

### Using Your Own Avatar ID

To use your own avatar ID with FULL and CUSTOM mode session initialization, you need to configure the avatar ID in `apps/demo/app/api/secrets.ts`:

1. **Update the Avatar ID**: Open `apps/demo/app/api/secrets.ts` and replace the `AVATAR_ID` value with your own avatar ID:

   ```typescript
   export const AVATAR_ID = "your-avatar-id-here";
   ```

2. **Configure API Key**: Make sure you have a valid API key set in the same file:

   ```typescript
   export const API_KEY = "your-api-key-here";
   ```

3. **For FULL Mode**: If using FULL mode, you may also need to configure:
   - `VOICE_ID`: Your avatar's voice ID
   - `CONTEXT_ID`: Your avatar's context ID
   - `LANGUAGE`: The language setting

4. **Restart the Server**: After making changes, restart your development server:
   ```bash
   pnpm run dev
   ```

### API Routes

The demo includes two session initialization routes:

- **`/api/start-session`**: Initializes a FULL mode session with your avatar ID, voice, context, and language
- **`/api/start-custom-session`**: Initializes a CUSTOM mode session with your avatar ID

Both routes automatically use the `AVATAR_ID` configured in `secrets.ts`.

### Important Notes

- ⚠️ **Never commit your actual API keys to version control**
- ✅ For production, use environment variables instead of hardcoding in `secrets.ts`
- 🔑 Get your API key and avatar IDs from your LiveAvatar dashboard
- 🔄 After changing the avatar ID, you must restart the server for changes to take effect
