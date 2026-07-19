import Anthropic from "@anthropic-ai/sdk";
import { hashApiKey } from "@/lib/apiKey";
import { anthropic, modelForPlan, thinkingConfigForPlan } from "@/lib/claude";
import { checkRateLimit } from "@/lib/rateLimit";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { ChatMessage } from "@/lib/types";

function extractBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token || null;
}

export async function POST(request: Request) {
  const apiKey = extractBearerToken(request);
  if (!apiKey) {
    return Response.json(
      { error: "Authorization: Bearer <APIキー> ヘッダーが必要です" },
      { status: 401 },
    );
  }

  const hashedKey = hashApiKey(apiKey);

  const { allowed, retryAfterSeconds } = checkRateLimit(`apikey:${hashedKey}`);
  if (!allowed) {
    return Response.json(
      { error: "しばらく時間をおいてから再度お試しください" },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
    );
  }

  let body: { messages?: ChatMessage[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { messages } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: "messages is required" }, { status: 400 });
  }

  // This request carries no user session — the API key (verified here by
  // exact hash match) is the only credential — so the lookup goes through
  // the service-role client rather than the RLS-scoped one. See the
  // migration note on agents.api_key for why a permissive RLS policy isn't
  // a safe alternative.
  const { data: agent, error } = await supabaseAdmin
    .from("agents")
    .select("system_prompt")
    .eq("api_key", hashedKey)
    .maybeSingle();

  if (error || !agent?.system_prompt) {
    return Response.json({ error: "APIキーが無効です" }, { status: 401 });
  }

  try {
    // Issuing an API key already requires a Pro/Business plan (see
    // /api/agents/[id]/api-key), so every key-authenticated call runs at
    // that tier — mirrors the same fixed-plan reasoning in /api/a/[id]/chat.
    const plan = "pro" as const;
    const thinking = thinkingConfigForPlan(plan);
    const response = await anthropic.messages.create({
      model: modelForPlan(plan),
      max_tokens: 2048,
      system: agent.system_prompt,
      ...(thinking ? { thinking } : {}),
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const textBlock = response.content.find((block) => block.type === "text");
    const reply = textBlock?.type === "text" ? textBlock.text : "";

    return Response.json({ reply });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return Response.json(
        { error: "ANTHROPIC_API_KEY が正しく設定されていません" },
        { status: 500 },
      );
    }
    if (err instanceof Anthropic.RateLimitError) {
      return Response.json(
        { error: "リクエストが混み合っています。しばらくしてから再度お試しください" },
        { status: 429 },
      );
    }
    if (err instanceof Anthropic.APIError) {
      return Response.json({ error: err.message }, { status: err.status ?? 500 });
    }
    return Response.json({ error: "予期しないエラーが発生しました" }, { status: 500 });
  }
}
