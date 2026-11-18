import { zValidator } from "@hono/zod-validator";
import type { ValidationTargets } from "hono";
import type { z } from "zod";

import { AppError } from "./errors.ts";

export function validate<T extends keyof ValidationTargets, S extends z.ZodType>(
  target: T,
  schema: S,
) {
  return zValidator(target, schema, (result) => {
    if (!result.success) {
      throw new AppError(
        "validation_error",
        "Requisição inválida",
        result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      );
    }
  });
}
