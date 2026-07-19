import { generateApiKey, hashApiKey } from "@/lib/apiKey";
import { createClient } from "@/lib/supabase/server";
import { getUserPlan } from "@/lib/user";

export async function POST(request: Request, { params }: RouteContext<"/api/agents/[id]/api-key">) {
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
    return Response.json({ error: "API発行はPro/Businessプランの機能です" }, { status: 403 });
  }

  const apiKey = generateApiKey();

  const { data: agent, error } = await supabase
    .from("agents")
    .update({ api_key: hashApiKey(apiKey) })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .single();

  if (error || !agent) {
    return Response.json({ error: "エージェントが見つかりませんでした" }, { status: 404 });
  }

  // The only time the plaintext key is ever available — the DB only ever
  // holds its hash from here on, and there's no way to recover it later.
  return Response.json({ apiKey });
}
