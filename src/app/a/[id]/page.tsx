import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PublicAgentChat from "./PublicAgentChat";

export default async function PublicAgentPage({ params }: PageProps<"/a/[id]">) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: agent } = await supabase
    .from("agents")
    .select("id, name")
    .eq("id", id)
    .eq("status", "published")
    .single();

  if (!agent) {
    notFound();
  }

  return (
    <main className="flex flex-1 flex-col max-w-2xl mx-auto w-full p-4 gap-4">
      <div className="border-b border-black/10 dark:border-white/15 pb-3">
        <h1 className="text-lg font-semibold">{agent.name}</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          このAIエージェントに質問できます。
        </p>
      </div>

      <PublicAgentChat agentId={agent.id} />
    </main>
  );
}
