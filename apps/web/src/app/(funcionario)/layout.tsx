import type { ReactNode } from "react";

import { EmployeeShell } from "@/components/employee/shell";
import { requireUser } from "@/server/session";

export default async function EmployeeLayout({ children }: { children: ReactNode }) {
  const user = await requireUser("funcionario");
  return <EmployeeShell user={{ name: user.name, email: user.email }}>{children}</EmployeeShell>;
}
