import type { ReactNode } from "react";

import { requireUser } from "@/server/session";

export default async function ConsoleLayout({ children }: { children: ReactNode }) {
  await requireUser("analista");
  return children;
}
