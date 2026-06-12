import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/ApiError";
import { executeTool } from "./handlers";
import { aiTools } from "./tools";

// The plan specified Haiku-tier for cost: Haiku 3.5 is retired, claude-haiku-4-5
// is its drop-in replacement ($1/$5 per MTok). Override with AI_MODEL in .env.
const MODEL = process.env.AI_MODEL ?? "claude-haiku-4-5";
const MAX_ITERATIONS = 6;

// $/MTok for cost logging. Keep in sync with platform.claude.com/docs pricing.
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5": { input: 1, output: 5 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-opus-4-8": { input: 5, output: 25 },
};

const client = new Anthropic({ apiKey: env.anthropicApiKey });

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

export interface AgentResult {
  answer: string;
  tokensUsed: number;
  costUsd: number;
  toolsCalled: string[];
}

async function buildSystemPrompt(businessId: string, branchId?: string): Promise<string> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      name: true,
      type: true,
      currency: true,
      timezone: true,
      branches: {
        where: { deletedAt: null },
        select: { id: true, name: true, code: true, isMainBranch: true },
      },
    },
  });
  if (!business) throw ApiError.notFound("Business not found");

  const branchList = business.branches
    .map((b) => `- ${b.name} (code: ${b.code}, id: ${b.id})${b.isMainBranch ? " [main]" : ""}`)
    .join("\n");

  return [
    `You are the business intelligence assistant for "${business.name}", a ${business.type} business using the Smart POS system.`,
    ``,
    `Business context:`,
    `- Currency: ${business.currency} (format amounts with this currency)`,
    `- Timezone: ${business.timezone}`,
    `- Today's date: ${new Date().toISOString().slice(0, 10)}`,
    `- Branches:`,
    branchList,
    branchId
      ? `\nThis conversation is scoped to branch id ${branchId}. All data you see is already filtered to that branch.`
      : `\nWhen the user names a branch, pass its id as branchId to tools. When they don't, query across all branches.`,
    ``,
    `Answer questions about sales, inventory, products, and branch performance using the available tools — never invent numbers.`,
    `Be concise and practical: lead with the answer, then one or two supporting facts. Suggest a concrete action when the data warrants it (e.g. restocking).`,
    `If a question is not about this business's data, politely decline.`,
  ].join("\n");
}

export async function runAgent(
  businessId: string,
  question: string,
  branchId?: string
): Promise<AgentResult> {
  if (!env.anthropicApiKey) {
    throw ApiError.badRequest(
      "AI_NOT_CONFIGURED",
      "AI agent is not configured. Set ANTHROPIC_API_KEY on the server."
    );
  }

  const system = await buildSystemPrompt(businessId, branchId);
  const ctx = { businessId, branchId };

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
      .trim() || "I wasn't able to produce an answer. Please try rephrasing your question.";

  const pricing = PRICING[MODEL] ?? PRICING["claude-haiku-4-5"];
  const costUsd = (totalInput * pricing.input + totalOutput * pricing.output) / 1_000_000;

  return {
    answer,
    tokensUsed: totalInput + totalOutput,
    costUsd: Number(costUsd.toFixed(6)),
    toolsCalled,
  };
}
