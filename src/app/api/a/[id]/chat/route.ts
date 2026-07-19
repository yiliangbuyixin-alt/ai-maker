import Anthropic from "@anthropic-ai/sdk";
import { anthropic, modelForPlan, thinkingConfigForPlan } from "@/lib/claude";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { createClient } from "@/lib/supabase/server";
import type { ChatMessage } from "@/lib/types";

export async function POST(request: Request, { params }: RouteContext<"/api/a/[id]/chat">) {
  const { id } = await params;

  const { allowed, retryAfterSeconds } = checkRateLimit(`ip:${getClientIp(request)}`);
  if (!allowed) {
    return Response.json(
      { error: "しばらく時間をおいてから再度お試しください" },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
    );
  }

  const supabase = await createClient();

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

  const { data: agent, error: fetchError } = await supabase
    .from("agents")
    .select("system_prompt")
    .eq("id", id)
    .eq("status", "published")
    .single();

  if (fetchError || !agent?.system_prompt) {
    return Response.json({ error: "エージェントが見つかりませんでした" }, { status: 404 });
  }

  try {
    // Publishing an agent already requires a Pro/Business plan (see
    // /api/agents/[id]/publish), so every publicly reachable agent runs at
    // that tier. There's no per-visitor plan to look up here anyway: the
    // visitor isn't logged in, and RLS blocks anonymous reads of user_usage.
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
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return Response.json(
        { error: "ANTHROPIC_API_KEY が正しく設定されていません" },
        { status: 500 },
      );
    }
    if (error instanceof Anthropic.RateLimitError) {
      return Response.json(
        { error: "リクエストが混み合っています。しばらくしてから再度お試しください" },
        { status: 429 },
      );
    }
    if (error instanceof Anthropic.APIError) {
      return Response.json({ error: error.message }, { status: error.status ?? 500 });
    }
    return Response.json({ error: "予期しないエラーが発生しました" }, { status: 500 });
  }
}
