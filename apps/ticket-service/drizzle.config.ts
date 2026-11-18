import { defineConfig } from "drizzle-kit";

// Usado só pelo `pnpm db:generate`, que gera os arquivos SQL de migração a
// partir de src/db/schema.ts. As migrações são aplicadas pelo próprio serviço
// ao subir (veja src/db/client.ts).
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
});
