import Anthropic from "@anthropic-ai/sdk";
import { anthropic, modelForPlan, thinkingConfigForPlan } from "@/lib/claude";
import { createClient } from "@/lib/supabase/server";
import { CATEGORY_SETS, type ChatMessage, type InterviewMode } from "@/lib/types";
import { getUserPlan } from "@/lib/user";

const FREE_PLAN_CATEGORY_LIMIT = 3;

function buildSystemPrompt(mode: InterviewMode): string {
  const categories = CATEGORY_SETS[mode];
  const total = categories.length;
  return `あなたはプロのインタビュアーです。目的は、ユーザーの専門知識・経験を引き出し、
他者が使えるAIの「知識ベース」として構造化することです。
1問1答形式で、以下${total}カテゴリを順に深掘りしてください:
${categories.join("、")}。
1メッセージにつき1〜2質問まで。抽象的な回答には具体例を求めてください。
全カテゴリが埋まったら『知識の整理が完了しました』と伝えてください。

【進捗報告について】
上記${total}カテゴリのうち、これまでに十分な情報が得られて完了したと判断できるカテゴリの累計数を、
応答の最後に改行してから必ず次の形式で追記してください。この行はシステムが機械的に読み取る内部情報です。
[PROGRESS completed=X]
Xは0から${total}の整数とし、これまでに完了した累計数を表します。会話が進むにつれて減ることはなく、同じか増加します。`;
}

function extractCompletedCategories(text: string, total: number): number {
  const match = text.match(/\[PROGRESS completed=(\d+)\]/);
  if (!match) return 0;
  const value = Number.parseInt(match[1], 10);
  if (Number.isNaN(value)) return 0;
  return Math.min(Math.max(value, 0), total);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "ログインが必要です" }, { status: 401 });
  }

  let body: { messages?: ChatMessage[]; mode?: InterviewMode };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { messages, mode = "full" } = body;
  const total = CATEGORY_SETS[mode].length;

  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: "messages is required" }, { status: 400 });
  }

  const plan = await getUserPlan(supabase, user.id);

  // Only gate modes with more categories than the free-plan limit — a
  // "quick" (3-category) interview is fully completable on the free plan.
  const freePlanGated = plan === "free" && total > FREE_PLAN_CATEGORY_LIMIT;

  const lastAssistantMessage = [...messages]
    .reverse()
    .find((m) => m.role === "assistant");

  if (freePlanGated && lastAssistantMessage) {
    const priorCompleted = extractCompletedCategories(lastAssistantMessage.content, total);
    if (priorCompleted >= FREE_PLAN_CATEGORY_LIMIT) {
      return Response.json(
        { blocked: true, completedCategories: priorCompleted, reply: "" },
        { status: 403 },
      );
    }
  }

  try {
    const thinking = thinkingConfigForPlan(plan);
    const response = await anthropic.messages.create({
      model: modelForPlan(plan),
      max_tokens: 2048,
      system: buildSystemPrompt(mode),
      ...(thinking ? { thinking } : {}),
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const textBlock = response.content.find((block) => block.type === "text");
    const reply = textBlock?.type === "text" ? textBlock.text : "";

    const completedCategories = extractCompletedCategories(reply, total);
    const blocked = freePlanGated && completedCategories >= FREE_PLAN_CATEGORY_LIMIT;

    return Response.json({ reply, completedCategories, totalCategories: total, blocked });
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
