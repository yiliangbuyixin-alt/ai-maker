import Anthropic from "@anthropic-ai/sdk";
import { anthropic, modelForPlan, thinkingConfigForPlan } from "@/lib/claude";
import { createClient } from "@/lib/supabase/server";
import { CATEGORY_SETS, type ChatMessage, type InterviewMode, type InterviewSummary } from "@/lib/types";
import { getUserPlan } from "@/lib/user";

function buildSummarySystemPrompt(mode: InterviewMode): string {
  const categories = CATEGORY_SETS[mode];
  return `あなたは、インタビュー形式で聞き出した専門家の知識を、
他者が使えるAIの「知識ベース」として構造化するアシスタントです。
これまでの会話全体を読み、以下の観点でユーザーの発言内容を要約・整理してください。
${categories.map((c) => `- ${c}`).join("\n")}
各項目は、会話に出てきた具体例を活かしながら、第三者が読んでそのまま参考にできるように簡潔にまとめてください。
会話に含まれていない情報を創作しないでください。`;
}

function buildSummarySchema(mode: InterviewMode) {
  const properties: Record<string, { type: "string"; description: string }> = {
    specialty: { type: "string", description: "ユーザーの専門分野を一言で" },
    expertiseAndBasis: { type: "string", description: "専門領域とその根拠" },
    commonConsultations: { type: "string", description: "よくある相談とその回答パターン" },
  };

  if (mode === "full") {
    properties.judgmentCriteria = { type: "string", description: "判断基準や暗黙知" };
    properties.ngPoints = { type: "string", description: "NGな回答・注意点" };
  }

  properties.toneAndCharacter = { type: "string", description: "口調やキャラクター" };

  return {
    type: "object",
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  } as const;
}

function buildAgentSystemPrompt(summary: InterviewSummary): string {
  const sections = [
    { title: "専門領域とその根拠", content: summary.expertiseAndBasis },
    { title: "よくある相談とその回答パターン", content: summary.commonConsultations },
    ...(summary.judgmentCriteria
      ? [{ title: "判断基準や暗黙知", content: summary.judgmentCriteria }]
      : []),
    ...(summary.ngPoints ? [{ title: "NGな回答・注意点", content: summary.ngPoints }] : []),
    { title: "口調やキャラクター", content: summary.toneAndCharacter },
  ];

  return `あなたは「${summary.specialty}」の専門知識を持つAIエージェントです。
以下の知識ベースに基づいて、一貫した判断基準と口調で回答してください。

${sections.map((s) => `## ${s.title}\n${s.content}`).join("\n\n")}`;
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

  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: "messages is required" }, { status: 400 });
  }

  const plan = await getUserPlan(supabase, user.id);

  try {
    const thinking = thinkingConfigForPlan(plan);
    const response = await anthropic.messages.create({
      model: modelForPlan(plan),
      max_tokens: 2048,
      system: buildSummarySystemPrompt(mode),
      ...(thinking ? { thinking } : {}),
      output_config: {
        format: { type: "json_schema", schema: buildSummarySchema(mode) },
      },
      messages: [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        {
          role: "user" as const,
          content: "ここまでの内容を、指定されたJSON形式で要約してください。",
        },
      ],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    const raw = textBlock?.type === "text" ? textBlock.text : "";

    let summary: InterviewSummary;
    try {
      summary = JSON.parse(raw) as InterviewSummary;
    } catch {
      return Response.json({ error: "要約の生成結果を解析できませんでした" }, { status: 502 });
    }

    const { data: agent, error: saveError } = await supabase
      .from("agents")
      .insert({
        user_id: user.id,
        name: summary.specialty,
        system_prompt: buildAgentSystemPrompt(summary),
        status: "active",
      })
      .select("id")
      .single();

    if (saveError) {
      console.error("Failed to save agent to Supabase:", saveError.message);
      return Response.json({ summary, saved: false, saveError: saveError.message });
    }

    return Response.json({ summary, saved: true, agentId: agent.id });
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
