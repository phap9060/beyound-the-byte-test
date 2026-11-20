import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { MastraModelConfig } from "@mastra/core/llm";

export const DEFAULT_MODEL = "gemini-3.5-flash-lite";

export function createGeminiModel(options: {
  apiKey: string;
  model?: string | undefined;
}): MastraModelConfig {
  return createGoogleGenerativeAI({ apiKey: options.apiKey })(options.model ?? DEFAULT_MODEL);
}
