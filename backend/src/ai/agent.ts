import { env } from "../config/env";
import { prisma } from "../lib/prisma";
import { ApiError } from "../utils/ApiError";
import { runClaude } from "./providers/claude.provider";
import { runGemini } from "./providers/gemini.provider";

export interface ToolContext {
  businessId: string;
  branchId?: string;
}

export interface AgentResult {
  answer: string;
  tokensUsed: number;
  costUsd: number;
  toolsCalled: string[];
}

export const MAX_ITERATIONS = 6;

export const FALLBACK_ANSWER =
  "I wasn't able to produce an answer. Please try rephrasing your question.";

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

// Provider resolution: explicit AI_PROVIDER wins; otherwise prefer whichever
// API key is configured (Gemini first — it's the free tier).
function resolveProvider(): "claude" | "gemini" {
  if (env.aiProvider === "claude" || env.aiProvider === "gemini") return env.aiProvider;
  if (env.geminiApiKey) return "gemini";
  if (env.anthropicApiKey) return "claude";
  throw ApiError.badRequest(
    "AI_NOT_CONFIGURED",
    "AI agent is not configured. Set GEMINI_API_KEY or ANTHROPIC_API_KEY on the server."
  );
}

export async function runAgent(
  businessId: string,
  question: string,
  branchId?: string
): Promise<AgentResult> {
  const system = await buildSystemPrompt(businessId, branchId);
  const ctx: ToolContext = { businessId, branchId };

  const provider = resolveProvider();
  return provider === "gemini"
    ? runGemini(system, ctx, question)
    : runClaude(system, ctx, question);
}
