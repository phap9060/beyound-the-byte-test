import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@nexo/domain", "@nexo/ticket-client"],
  serverExternalPackages: ["@libsql/client"],
  typedRoutes: true,
};

export default config;
