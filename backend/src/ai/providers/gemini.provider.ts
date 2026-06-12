import {
  Content,
  FunctionDeclaration,
  GoogleGenAI,
  Part,
  Schema,
  Type,
} from "@google/genai";
import { env } from "../../config/env";
import { ApiError } from "../../utils/ApiError";
import { AgentResult, FALLBACK_ANSWER, MAX_ITERATIONS, ToolContext } from "../agent";
import { executeTool } from "../handlers";
import { aiTools } from "../tools";

// Free tier: 1,500 requests/day on Gemini 2.5 Flash (as of mid-2026).
// Override with GEMINI_MODEL in .env.
const MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

// Convert our Anthropic-style JSON Schema tool definitions to Gemini's
// FunctionDeclaration format (uppercase Type enum, same structure).
const TYPE_MAP: Record<string, Type> = {
  object: Type.OBJECT,
  string: Type.STRING,
  number: Type.NUMBER,
  integer: Type.INTEGER,
  boolean: Type.BOOLEAN,
  array: Type.ARRAY,
};

function toGeminiSchema(schema: {
  type: string;
  properties?: Record<string, { type?: string; description?: string } | undefined>;
  required?: string[];
}): Schema {
  const propEntries = Object.entries(schema.properties ?? {}).filter(
    (entry): entry is [string, { type?: string; description?: string }] => entry[1] !== undefined
  );
  return {
    type: TYPE_MAP[schema.type] ?? Type.OBJECT,
    ...(propEntries.length
      ? {
          properties: Object.fromEntries(
            propEntries.map(([key, prop]) => [
              key,
              {
                type: TYPE_MAP[prop.type ?? "string"] ?? Type.STRING,
                ...(prop.description ? { description: prop.description } : {}),
              },
            ])
          ),
        }
      : {}),
    ...(schema.required?.length ? { required: schema.required } : {}),
  };
}

const functionDeclarations: FunctionDeclaration[] = aiTools.map((tool) => ({
  name: tool.name,
  description: tool.description,
  parameters: toGeminiSchema(tool.input_schema),
}));

function mapProviderError(e: unknown): ApiError {
  const msg = e instanceof Error ? e.message : String(e);
  if (/API key|PERMISSION_DENIED|401|403/i.test(msg)) {
    return new ApiError(502, "AI_AUTH_FAILED", "AI provider rejected the server's API key");
  }
  if (/RESOURCE_EXHAUSTED|429|quota/i.test(msg)) {
    return new ApiError(
      503,
      "AI_RATE_LIMITED",
      "AI provider daily free quota reached — try again later"
    );
  }
  return new ApiError(502, "AI_PROVIDER_ERROR", "AI provider error — try again shortly");
}

export async function runGemini(
  system: string,
  ctx: ToolContext,
  question: string
): Promise<AgentResult> {
  if (!env.geminiApiKey) {
    throw ApiError.badRequest(
      "AI_NOT_CONFIGURED",
      "Gemini provider selected but GEMINI_API_KEY is not set."
    );
  }

  const ai = new GoogleGenAI({ apiKey: env.geminiApiKey });

  const contents: Content[] = [{ role: "user", parts: [{ text: question }] }];
  let totalTokens = 0;
  const toolsCalled: string[] = [];
  let finalText = "";

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    let response;
    try {
      response = await ai.models.generateContent({
        model: MODEL,
        contents,
        config: {
          systemInstruction: system,
          tools: [{ functionDeclarations }],
          maxOutputTokens: 2048,
        },
      });
    } catch (e) {
      throw mapProviderError(e);
    }

    totalTokens += response.usageMetadata?.totalTokenCount ?? 0;

    const calls = response.functionCalls;
    const modelParts = response.candidates?.[0]?.content?.parts ?? [];
    finalText = (response.text ?? "").trim();

    if (!calls || calls.length === 0) break;

    contents.push({ role: "model", parts: modelParts });

    const resultParts: Part[] = [];
    for (const call of calls) {
      const name = call.name ?? "unknown";
      toolsCalled.push(name);
      let result: unknown;
      try {
        result = await executeTool(name, ctx, (call.args ?? {}) as Record<string, unknown>);
      } catch (e) {
        result = { error: e instanceof Error ? e.message : String(e) };
      }
      resultParts.push({
        functionResponse: {
          name,
          response: { result },
        },
      });
    }
    contents.push({ role: "user", parts: resultParts });
  }

  return {
    answer: finalText || FALLBACK_ANSWER,
    tokensUsed: totalTokens,
    costUsd: 0, // free tier
    toolsCalled,
  };
}
