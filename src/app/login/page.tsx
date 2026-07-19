"use client";

import { useActionState, useState } from "react";
import { login, signup, type AuthFormState } from "./actions";

const initialState: AuthFormState = undefined;

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loginState, loginAction, loginPending] = useActionState(login, initialState);
  const [signupState, signupAction, signupPending] = useActionState(signup, initialState);

  const state = mode === "login" ? loginState : signupState;
  const action = mode === "login" ? loginAction : signupAction;
  const pending = mode === "login" ? loginPending : signupPending;

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm flex flex-col gap-4 rounded-xl border border-black/10 dark:border-white/15 p-6">
        <div className="flex gap-2 text-sm">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`flex-1 rounded-md py-2 font-medium ${
              mode === "login"
                ? "bg-foreground text-background"
                : "bg-black/5 dark:bg-white/10"
            }`}
          >
            ログイン
          </button>
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`flex-1 rounded-md py-2 font-medium ${
              mode === "signup"
                ? "bg-foreground text-background"
                : "bg-black/5 dark:bg-white/10"
            }`}
          >
            新規登録
          </button>
        </div>

        <form action={action} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="email" className="text-xs text-black/60 dark:text-white/60">
              メールアドレス
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:focus:border-white/40"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="password" className="text-xs text-black/60 dark:text-white/60">
              パスワード
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              className="rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:focus:border-white/40"
            />
          </div>

          {state?.error && (
            <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
          )}
          {state?.message && (
            <p className="text-sm text-green-600 dark:text-green-400">{state.message}</p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium disabled:opacity-40"
          >
            {pending ? "処理中..." : mode === "login" ? "ログイン" : "登録する"}
          </button>
        </form>
      </div>
    </main>
  );
}
