"use client";

import { Send, Sparkles, Wrench } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, ApiRequestError } from "@/lib/api";
import type { Branch } from "@/lib/types";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  toolsCalled?: string[];
  pending?: boolean;
}

interface HistoryEntry {
  id: string;
  question: string;
  response: string;
  createdAt: string;
}

interface Usage {
  plan: string;
  today: { used: number; limit: number | null };
}

const TOOL_LABELS: Record<string, string> = {
  get_sales_summary: "Sales summary",
  get_top_products: "Top products",
  get_low_stock_items: "Low stock",
  get_reorder_suggestions: "Reorder suggestions",
  compare_branch_performance: "Branch comparison",
};

const STARTERS = [
  "What were my sales today?",
  "What should I restock?",
  "Which branch is performing better?",
  "What are my top selling products this month?",
];

export default function AiAssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [asking, setAsking] = useState(false);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState<string>("all");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get<Usage>("/ai/usage").then((res) => setUsage(res.data)).catch(() => {});
    api.get<Branch[]>("/branches?limit=100").then((res) => setBranches(res.data)).catch(() => {});
    // Preload the latest conversation history (newest first from API)
    api
      .get<HistoryEntry[]>("/ai/history?limit=10")
      .then((res) => {
        const thread: ChatMessage[] = [];
        for (const entry of [...res.data].reverse()) {
          thread.push({ id: `${entry.id}-q`, role: "user", text: entry.question });
          thread.push({ id: `${entry.id}-a`, role: "assistant", text: entry.response });
        }
        setMessages(thread);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || asking) return;
    setInput("");
    setAsking(true);
    const pendingId = crypto.randomUUID();
    setMessages((m) => [
      ...m,
      { id: crypto.randomUUID(), role: "user", text: q },
      { id: pendingId, role: "assistant", text: "", pending: true },
    ]);

    try {
      const res = await api.post<{
        answer: string;
        toolsCalled: string[];
        usage: { usedToday: number; limit: number | null };
      }>("/ai/query", {
        question: q,
        ...(branchId !== "all" ? { branchId } : {}),
      });
      setMessages((m) =>
        m.map((msg) =>
          msg.id === pendingId
            ? { ...msg, text: res.data.answer, toolsCalled: res.data.toolsCalled, pending: false }
            : msg
        )
      );
      setUsage((u) =>
        u ? { ...u, today: { used: res.data.usage.usedToday, limit: res.data.usage.limit } } : u
      );
    } catch (err) {
      const msg = err instanceof ApiRequestError ? err.message : "The assistant is unavailable";
      setMessages((m) => m.filter((x) => x.id !== pendingId));
      toast.error(msg);
    } finally {
      setAsking(false);
      inputRef.current?.focus();
    }
  }

  const limitText = usage
    ? usage.today.limit === null
      ? `${usage.today.used} queries today · unlimited on ${usage.plan}`
      : `${usage.today.used} of ${usage.today.limit} queries today on ${usage.plan}`
    : "";

  return (
    <div className="mx-auto flex h-[calc(100vh-7.5rem)] max-w-3xl flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <Sparkles className="h-5 w-5 text-primary" /> AI Assistant
          </h1>
          <p className="text-xs text-muted-foreground">
            Answers come from your live sales and inventory data. {limitText}
          </p>
        </div>
        {branches.length > 1 && (
          <Select value={branchId} onValueChange={setBranchId}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All branches</SelectItem>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto rounded-lg border bg-card p-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <Sparkles className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Ask anything about your business — sales, stock, branches, products.
            </p>
            <div className="flex max-w-md flex-wrap justify-center gap-2">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => ask(s)}
                  className="rounded-full border px-3 py-1.5 text-xs transition-colors hover:bg-accent"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
              }`}
            >
              {msg.pending ? (
                <span className="inline-flex gap-1 py-1" aria-label="Thinking">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
                </span>
              ) : (
                <div className="whitespace-pre-wrap">{msg.text}</div>
              )}
              {msg.toolsCalled && msg.toolsCalled.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {[...new Set(msg.toolsCalled)].map((tool) => (
                    <Badge key={tool} variant="outline" className="gap-1 text-[10px]">
                      <Wrench className="h-2.5 w-2.5" />
                      {TOOL_LABELS[tool] ?? tool}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="flex gap-2 pt-3"
      >
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. What should I restock at Gulshan?"
          disabled={asking}
          autoFocus
        />
        <Button type="submit" disabled={asking || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
