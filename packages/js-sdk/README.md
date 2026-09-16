# LiveAvatar Web SDK

## About

This is offical LiveAvatar supported client-side SDK.
This SDK library manages various LiveAvatar sessions, supporting the session initiation,
session management, and session cleanup.

## API Documentation

Please refer to us here https://docs.liveavatar.com

## Installation

Install the package in your project through package manager.

```bash
npm install @heygen/liveavatar-web-sdk
# or
pnpm install @heygen/liveavatar-web-sdk
```

## Usage

This library is meant for development use in various client-side facing JavaScript projects.
It's tailored to manage LiveAvatar sessions, handling the complexities of starting, stopping and various avatar actions. With just the session token, we help focus on the session complexity so you focus on building something great.

## Example Usage

```ts
import { LiveAvatarSession } from "@heygen/liveavatar-web-sdk";

// Make a backend call to grab the sessionToken
const { sessionToken } = await myBackendCallForSessionToken();
const userConfig = {
  // Opt in to automatic keep-alive. Defaults to false. When true, the SDK sends
  // a keep-alive request every minute while the session is connected.
  autoKeepAlive: true,
  // Microphone is on by default. For a text-only session use:
  // voiceChat: { defaultMuted: true },
};

const session = new LiveAvatarSession(sessionToken, userConfig);

// Start the session
await session.start();

// Build something great with LiveAvatar

// Close the session
await session.stop();
```

### Session config options

| Option          | Type              | Default | Description                                                                                                                                       |
| --------------- | ----------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `voiceChat`     | `VoiceChatConfig` | `{}`    | Voice chat settings applied on connect. Default turns the microphone on unmuted. Pass `{ defaultMuted: true }` for a text-only session. Also accepts `deviceId` and `mode`. |
| `autoKeepAlive` | `boolean`         | `false` | Opt in to automatic keep-alive. When `true`, the SDK calls `keepAlive()` every 60 seconds while connected. Otherwise call `keepAlive()` yourself. |

## License

LiveAvatar Web SDK is licensed under the MIT License.

Please refer to the LICENSE file for more information.
