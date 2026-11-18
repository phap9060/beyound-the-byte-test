// @ts-check
import eslint from "@eslint/js";
import prettier from "eslint-config-prettier";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // Pastas que nunca são analisadas
  {
    ignores: ["**/node_modules/**", "**/dist/**", "**/.next/**", "**/coverage/**", "**/*.d.ts"],
  },

  // Regras recomendadas do JavaScript
  eslint.configs.recommended,

  // Regras do TypeScript que usam as informações de tipo (type-aware)
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  {
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: {
        // Descobre o tsconfig.json mais próximo de cada arquivo
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Promise sem await: bug clássico ao chamar APIs e o LLM
      "@typescript-eslint/no-floating-promises": "error",
      // switch sobre union (status, prioridade) precisa cobrir todos os casos
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      // Força `import type` para tipos (combina com verbatimModuleSyntax)
      "@typescript-eslint/consistent-type-imports": "error",
      // Variável não usada é erro, exceto as que começam com _
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Permite números em template strings (`INC-${numero}`)
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
    },
  },

  // Arquivos de configuração em JS não têm tsconfig: desliga as regras com tipo
  {
    files: ["**/*.{js,mjs,cjs}"],
    extends: [tseslint.configs.disableTypeChecked],
  },

  // Por último: desliga as regras de estilo que conflitam com o Prettier
  prettier,
);
