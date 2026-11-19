import type { ReactNode } from "react";

import { requireUser } from "@/server/session";

export default async function EmployeeLayout({ children }: { children: ReactNode }) {
  await requireUser("funcionario");
  return children;
}
