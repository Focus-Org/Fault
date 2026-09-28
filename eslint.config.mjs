import js from "@eslint/js";
import security from "eslint-plugin-security";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: ["eslint.config.mjs", "dist/**", "examples/**"]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Config existante pour d'éventuels fichiers .js CommonJS (ex: scripts).
    files: ["**/*.js"],
    languageOptions: {
      sourceType: "commonjs",
      globals: {
        console: "readonly",
        exports: "readonly",
        module: "readonly",
        process: "readonly",
        require: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        Buffer: "readonly"
      }
    },
    plugins: {
      security
    },
    rules: {
      ...security.configs.recommended.rules,
      "no-empty": [
        "error",
        {
          allowEmptyCatch: true
        }
      ],
      "security/detect-non-literal-fs-filename": "off",
      "security/detect-unsafe-regex": "off",
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^(?:_|resolve|reject)$",
          varsIgnorePattern: "^_$"
        }
      ]
    }
  },
  {
    // Ce package (@fault/api-client) est en TypeScript + ESM ("type": "module")
    // — sans ce bloc, aucun fichier .ts ne matche et tout est ignoré.
    files: ["**/*.ts"],
    languageOptions: {
      sourceType: "module",
      parserOptions: {
        project: "./tsconfig.json"
      },
      globals: {
        console: "readonly",
        process: "readonly",
        Buffer: "readonly"
      }
    },
    plugins: {
      security
    },
    rules: {
      ...security.configs.recommended.rules,
      "no-empty": [
        "error",
        {
          allowEmptyCatch: true
        }
      ],
      "security/detect-non-literal-fs-filename": "off",
      "security/detect-unsafe-regex": "off",
      // La règle de base ne comprend pas les types (interfaces, imports
      // "type"...) : on la désactive au profit de la variante TS.
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^(?:_|resolve|reject)$",
          varsIgnorePattern: "^_$"
        }
      ]
    }
  }
];