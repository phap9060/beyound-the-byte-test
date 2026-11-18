import { createMiddleware } from "hono/factory";

import type { Database } from "../db/client.ts";
import { errorResponse, serviceError } from "../errors.ts";
import { employeeExists } from "../services/employees.ts";

export function requireEmployee(db: Database) {
  return createMiddleware<{ Variables: object }, "/:employeeId/*">(async (c, next) => {
    if (!(await employeeExists(db, c.req.param("employeeId")))) {
      return errorResponse(c, serviceError("employee_not_found", "Funcionário não encontrado"));
    }
    await next();
    return undefined;
  });
}
