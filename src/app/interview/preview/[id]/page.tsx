import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserPlan } from "@/lib/user";
import AgentChat from "./AgentChat";
import AgentProActions from "./AgentProActions";

function parseKnowledgeSections(systemPrompt: string): { title: string; content: string }[] {
  const parts = systemPrompt.split("\n\n## ").slice(1);
  return parts.map((part) => {
    const [title, ...rest] = part.split("\n");
    return { title: title.trim(), content: rest.join("\n").trim() };
  });
}

export default async function AgentPreviewPage({
  params,
}: PageProps<"/interview/preview/[id]">) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: agent, error } = await supabase
    .from("agents")
    .select("id, name, system_prompt, status, api_key")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !agent) {
    return (
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="max-w-md flex flex-col gap-3 text-center">
          <p className="text-sm text-black/60 dark:text-white/60">
            指定された知識ベースが見つかりませんでした。
          </p>
          <Link
            href="/interview"
            className="self-center rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium"
          >
            ヒアリングへ戻る
          </Link>
        </div>
      </main>
    );
  }

  const sections = parseKnowledgeSections(agent.system_prompt ?? "");
  const plan = await getUserPlan(supabase, user.id);

  return (
    <main className="flex flex-1 flex-col max-w-2xl mx-auto w-full p-4 gap-4">
      <div className="border-b border-black/10 dark:border-white/15 pb-3">
        <p className="text-xs text-black/50 dark:text-white/50">知識ベース プレビュー</p>
        <h1 className="text-lg font-semibold mt-1">{agent.name}</h1>
      </div>

      <AgentProActions
        agentId={agent.id}
        plan={plan}
        initialStatus={agent.status}
        hasApiKey={agent.api_key !== null}
      />

      <div className="flex flex-col gap-3">
        {sections.map((s) => (
          <section
            key={s.title}
            className="rounded-lg border border-black/10 dark:border-white/15 p-4"
          >
            <h2 className="text-sm font-semibold mb-1">{s.title}</h2>
            <p className="text-sm whitespace-pre-wrap text-black/80 dark:text-white/80">
              {s.content}
            </p>
          </section>
        ))}
      </div>

      <div className="border-t border-black/10 dark:border-white/15 pt-4">
        <h2 className="text-sm font-semibold mb-2">このエージェントとチャットする</h2>
        <AgentChat agentId={agent.id} />
      </div>

      <Link
        href="/interview"
        className="self-start text-sm underline text-black/60 dark:text-white/60"
      >
        新しくヒアリングを始める
      </Link>
    </main>
  );
}
