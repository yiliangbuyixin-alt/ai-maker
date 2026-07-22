import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const STATUS_LABEL: Record<string, string> = {
  active: "非公開",
  published: "公開中",
};

export default async function AgentsPage({ searchParams }: PageProps<"/agents">) {
  const { upgraded } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: agents } = await supabase
    .from("agents")
    .select("id, name, status, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const upgradedLabel = Array.isArray(upgraded) ? upgraded[0] : upgraded;

  return (
    <main className="flex flex-1 flex-col max-w-2xl mx-auto w-full p-4 gap-4">
      {upgradedLabel && (
        <p className="rounded-lg border border-green-600/30 bg-green-600/10 px-4 py-2 text-sm text-green-700 dark:text-green-400">
          {upgradedLabel === "business" ? "Business" : "Pro"}プランへのアップグレードが完了しました。
        </p>
      )}

      <div className="flex items-center justify-between border-b border-black/10 dark:border-white/15 pb-3">
        <h1 className="text-lg font-semibold">エージェント一覧</h1>
        <Link
          href="/interview"
          className="rounded-md bg-foreground text-background px-3 py-2 text-sm font-medium"
        >
          新しくヒアリングを始める
        </Link>
      </div>

      {!agents || agents.length === 0 ? (
        <p className="text-sm text-black/60 dark:text-white/60">
          まだ知識ベースがありません。ヒアリングを始めて最初のエージェントを作りましょう。
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {agents.map((agent) => (
            <li key={agent.id}>
              <Link
                href={`/interview/preview/${agent.id}`}
                className="flex items-center justify-between rounded-lg border border-black/10 dark:border-white/15 p-4 hover:border-black/40 dark:hover:border-white/40"
              >
                <span className="text-sm font-medium">{agent.name}</span>
                <span className="text-xs text-black/50 dark:text-white/50">
                  {STATUS_LABEL[agent.status] ?? agent.status}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
