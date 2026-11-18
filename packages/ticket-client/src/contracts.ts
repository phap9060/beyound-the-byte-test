import { CategorySchema } from "@nexo/domain";
import { z } from "zod";

export const KbSearchResultSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  category: CategorySchema,
  score: z.number(),
});
export type KbSearchResult = z.infer<typeof KbSearchResultSchema>;

export const ErrorBodySchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
