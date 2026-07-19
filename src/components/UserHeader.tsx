import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/login/actions";

export default async function UserHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return (
    <div className="flex items-center justify-end gap-3 px-4 py-2 border-b border-black/10 dark:border-white/15 text-sm">
      <span className="text-black/60 dark:text-white/60">{user.email}</span>
      <form action={logout}>
        <button
          type="submit"
          className="rounded-md border border-black/15 dark:border-white/20 px-3 py-1 text-xs font-medium hover:border-black/40 dark:hover:border-white/40"
        >
          ログアウト
        </button>
      </form>
    </div>
  );
}
