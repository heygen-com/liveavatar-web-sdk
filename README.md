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
It's tailored to manage LiveAvatar sessions, handling the complexities of starting, stopping and various avatar actions. With just the session id and token, we help focus on the session complexity so you focus on building something great.

## Example Usage

```ts
import { LiveAvatarSession } from "@heygen/liveavatar-web-sdk";

// Make a backend call to grab the sessionId and sessionToken
const { sessionId, sessionToken } = await myBackendCallForSessionToken();
const userConfig = {
  voiceChat: true,
};

const session = new LiveAvatarSession(sessionId, sessionToken, userConfig);

// Start the session
await session.start();

// Build something great with LiveAvatar

// Close the session
await session.stop();
```

## License

LiveAvatar Web SDK is licensed under the MIT License.

Please refer to the LICENSE file for more information.
