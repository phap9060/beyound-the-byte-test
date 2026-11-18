import { ok } from "@nexo/domain";
import type { Employee, Result } from "@nexo/domain";
import { eq } from "drizzle-orm";

import type { Database } from "../db/client.ts";
import { employees } from "../db/schema.ts";
import { fail } from "../errors.ts";
import type { ServiceError } from "../errors.ts";

type EmployeeRow = typeof employees.$inferSelect;

function toEmployee({ supportTeam, ...rest }: EmployeeRow): Employee {
  return { ...rest, ...(supportTeam === null ? {} : { supportTeam }) };
}

function found(row: EmployeeRow | undefined): Result<Employee, ServiceError> {
  return row ? ok(toEmployee(row)) : fail("employee_not_found", "Funcionário não encontrado");
}

export async function findEmployeeByEmail(
  db: Database,
  email: string,
): Promise<Result<Employee, ServiceError>> {
  return found(
    await db.query.employees.findFirst({ where: eq(employees.email, email.trim().toLowerCase()) }),
  );
}

export async function getEmployee(
  db: Database,
  id: string,
): Promise<Result<Employee, ServiceError>> {
  return found(await db.query.employees.findFirst({ where: eq(employees.id, id) }));
}

export async function employeeExists(db: Database, id: string): Promise<boolean> {
  const row = await db.query.employees.findFirst({
    columns: { id: true },
    where: eq(employees.id, id),
  });
  return row !== undefined;
}
