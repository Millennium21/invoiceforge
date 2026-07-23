import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Raw apostrophes in JSX text ("you're", "don't") are not a real bug
      // — React renders them correctly. This rule would force every
      // contraction in the app's copy into an HTML entity, which hurts
      // source readability for no runtime benefit.
      "react/no-unescaped-entities": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Deno runtime, not Node/Next.js — separate project, separate linter
    // (deno lint), same reasoning as the tsconfig.json exclude.
    "supabase/functions/**",
  ]),
]);

export default eslintConfig;
