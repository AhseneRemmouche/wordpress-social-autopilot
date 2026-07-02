import nextConfig from "eslint-config-next";
import eslintConfigPrettier from "eslint-config-prettier";

// Next.js 16 ships a native flat-config array (core-web-vitals + TypeScript
// plugin/parser). Spread it directly — no FlatCompat (which hits a circular
// structure bug under ESLint 9).
const eslintConfig = [
  ...nextConfig,

  // Constitution Principle I — strict typing, no `any`, explicit boundaries.
  // Scoped to TS files so these @typescript-eslint rules don't apply to plain
  // .mjs config files (where the plugin isn't registered).
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/explicit-module-boundary-types": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },

  // Prettier last — disables ESLint rules that conflict with formatting.
  eslintConfigPrettier,

  {
    ignores: ["node_modules/**", ".next/**", "coverage/**", ".opencode/**"],
  },
];

export default eslintConfig;
