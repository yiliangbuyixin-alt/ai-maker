import Anthropic from "@anthropic-ai/sdk";
import { anthropic, modelForPlan, thinkingConfigForPlan } from "@/lib/claude";
import { createClient } from "@/lib/supabase/server";
import type { ChatMessage } from "@/lib/types";
import { getUserPlan } from "@/lib/user";

export async function POST(request: Request, { params }: RouteContext<"/api/agents/[id]/chat">) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "ログインが必要です" }, { status: 401 });
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

  const { data: agent, error: fetchError } = await supabase
    .from("agents")
    .select("system_prompt")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !agent?.system_prompt) {
    return Response.json({ error: "エージェントが見つかりませんでした" }, { status: 404 });
  }

  try {
    const plan = await getUserPlan(supabase, user.id);
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
