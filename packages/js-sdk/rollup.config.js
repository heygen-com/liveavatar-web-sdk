import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import json from "@rollup/plugin-json";
import nodePolyfills from "rollup-plugin-polyfill-node";

export default [
  // Unbundled builds for npm (lib/)
  {
    input: "src/index.ts",
    output: [
      {
        file: "lib/index.cjs.js",
        format: "cjs",
      },
      {
        file: "lib/index.esm.js",
        format: "esm",
      },
    ],
    plugins: [
      json(),
      resolve(),
      commonjs(),
      typescript({
        declaration: true,
        declarationDir: "lib",
        rootDir: "src",
      }),
    ],
    external: [
      "livekit-client",
      "webrtc-issue-detector",
      "events",
      "typed-emitter",
    ],
  },
  // Bundled builds for browser/CDN (dist/)
  {
    input: "src/index.ts",
    output: [
      {
        file: "dist/index.umd.js",
        format: "umd",
        name: "LiveAvatarSDK", // Global variable name for browser
        sourcemap: true,
        globals: {
          events: "EventEmitter",
        },
      },
      {
        file: "dist/index.esm.js",
        format: "esm",
        sourcemap: true,
      },
    ],
    plugins: [
      json(),
      nodePolyfills(), // Polyfills for Node built-ins in browser
      resolve({
        browser: true,
        preferBuiltins: false, // Use polyfills instead of Node built-ins
      }),
      commonjs(),
      typescript({
        declaration: false, // No need for .d.ts in bundled version
        rootDir: "src",
      }),
    ],
    // No external dependencies - bundle everything
  },
];
