import { nextJsConfig } from "@repo/eslint-config/next-js";

/** @type {import("eslint").Linter.Config} */
export default [
  ...nextJsConfig,
  {
    rules: {
      // Allow HEYGEN env vars since they are listed in turbo.json build task
      "turbo/no-undeclared-env-vars": [
        "error",
        {
          allowList: ["^HEYGEN_.*"],
        },
      ],
    },
  },
];
