import { createClient } from "@/lib/supabase/server";
import { getUserPlan } from "@/lib/user";

export async function POST(request: Request, { params }: RouteContext<"/api/agents/[id]/publish">) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "ログインが必要です" }, { status: 401 });
  }

  const plan = await getUserPlan(supabase, user.id);
  if (plan === "free") {
    return Response.json(
      { error: "Web公開はPro/Businessプランの機能です" },
      { status: 403 },
    );
  }

  let body: { publish?: boolean };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const nextStatus = body.publish === false ? "active" : "published";

  const { data: agent, error } = await supabase
    .from("agents")
    .update({ status: nextStatus })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id, status")
    .single();

  if (error || !agent) {
    return Response.json({ error: "エージェントが見つかりませんでした" }, { status: 404 });
  }

  return Response.json({ status: agent.status });
}
