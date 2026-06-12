import Anthropic from "@anthropic-ai/sdk";
import { env } from "../../config/env";
import { ApiError } from "../../utils/ApiError";
import { AgentResult, FALLBACK_ANSWER, MAX_ITERATIONS, ToolContext } from "../agent";
import { executeTool } from "../handlers";
import { aiTools } from "../tools";

// The plan specified Haiku-tier for cost: Haiku 3.5 is retired, claude-haiku-4-5
// is its drop-in replacement ($1/$5 per MTok). Override with AI_MODEL in .env.
const MODEL = process.env.AI_MODEL ?? "claude-haiku-4-5";

// $/MTok for cost logging. Keep in sync with platform.claude.com/docs pricing.
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5": { input: 1, output: 5 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-opus-4-8": { input: 5, output: 25 },
};

// Translate Anthropic API failures into clean client-facing errors instead of
// generic 500s. The raw message is logged by the SDK; we expose a safe summary.
function mapProviderError(e: unknown): ApiError {
  if (e instanceof Anthropic.AuthenticationError) {
    return new ApiError(502, "AI_AUTH_FAILED", "AI provider rejected the server's API key");
  }
  if (e instanceof Anthropic.RateLimitError) {
    return new ApiError(503, "AI_RATE_LIMITED", "AI provider is rate limiting — try again shortly");
  }
  if (e instanceof Anthropic.BadRequestError) {
    const msg = e.message.includes("credit balance")
      ? "AI provider account has insufficient credits"
      : "AI provider rejected the request";
    return new ApiError(502, "AI_PROVIDER_ERROR", msg);
  }
  if (e instanceof Anthropic.APIError) {
    return new ApiError(502, "AI_PROVIDER_ERROR", "AI provider error — try again shortly");
  }
  return new ApiError(500, "INTERNAL_ERROR", "Something went wrong");
}

export async function runClaude(
  system: string,
  ctx: ToolContext,
  question: string
): Promise<AgentResult> {
  if (!env.anthropicApiKey) {
    throw ApiError.badRequest(
      "AI_NOT_CONFIGURED",
      "Claude provider selected but ANTHROPIC_API_KEY is not set."
    );
  }

  const client = new Anthropic({ apiKey: env.anthropicApiKey });

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: question }];
  let totalInput = 0;
  let totalOutput = 0;
  const toolsCalled: string[] = [];
  let response: Anthropic.Message | undefined;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    try {
      response = await client.messages.create({
        model: MODEL,
        max_tokens: 2048,
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        tools: aiTools as Anthropic.Tool[],
        messages,
      });
    } catch (e) {
      throw mapProviderError(e);
    }

    totalInput += response.usage.input_tokens;
    totalOutput += response.usage.output_tokens;

    if (response.stop_reason !== "tool_use") break;

    messages.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;
      toolsCalled.push(block.name);
      let result: unknown;
      let isError = false;
      try {
        result = await executeTool(block.name, ctx, block.input as Record<string, unknown>);
      } catch (e) {
        result = { error: e instanceof Error ? e.message : String(e) };
        isError = true;
      }
      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: JSON.stringify(result),
        is_error: isError,
      });
    }
    messages.push({ role: "user", content: toolResults });
  }

  const answer =
    response?.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim() || FALLBACK_ANSWER;

  const pricing = PRICING[MODEL] ?? PRICING["claude-haiku-4-5"];
  const costUsd = (totalInput * pricing.input + totalOutput * pricing.output) / 1_000_000;

  return {
    answer,
    tokensUsed: totalInput + totalOutput,
    costUsd: Number(costUsd.toFixed(6)),
    toolsCalled,
  };
}
