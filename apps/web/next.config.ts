import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@nexo/domain", "@nexo/ticket-client", "@nexo/agent"],
  serverExternalPackages: ["@libsql/client"],
  typedRoutes: true,
};

export default config;
