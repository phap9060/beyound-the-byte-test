import type { Employee } from "@nexo/domain";
import { eq } from "drizzle-orm";

import type { Database } from "../db/client.ts";
import { employees } from "../db/schema.ts";
import { AppError } from "../errors.ts";

type EmployeeRow = typeof employees.$inferSelect;

function toEmployee({ supportTeam, ...rest }: EmployeeRow): Employee {
  return { ...rest, ...(supportTeam === null ? {} : { supportTeam }) };
}

export async function findEmployeeByEmail(db: Database, email: string): Promise<Employee> {
  const row = await db.query.employees.findFirst({
    where: eq(employees.email, email.trim().toLowerCase()),
  });
  if (!row) throw new AppError("employee_not_found", "Funcionário não encontrado");
  return toEmployee(row);
}

export async function getEmployee(db: Database, id: string): Promise<Employee> {
  const row = await db.query.employees.findFirst({ where: eq(employees.id, id) });
  if (!row) throw new AppError("employee_not_found", "Funcionário não encontrado");
  return toEmployee(row);
}
