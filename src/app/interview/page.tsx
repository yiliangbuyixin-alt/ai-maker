"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import UpgradeModal from "@/components/UpgradeModal";
import { CATEGORY_SETS, type ChatMessage, type InterviewMode } from "@/lib/types";

function displayText(content: string): string {
  return content.replace(/\n?\[PROGRESS completed=\d+\]\s*$/, "").trim();
}

export default function InterviewPage() {
  const router = useRouter();
  const [mode, setMode] = useState<InterviewMode | null>(null);
  const [specialty, setSpecialty] = useState("");
  const [started, setStarted] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [completedCategories, setCompletedCategories] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, loading]);

  async function sendMessages(nextMessages: ChatMessage[], activeMode: InterviewMode) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages, mode: activeMode }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.blocked) {
          setBlocked(true);
          setCompletedCategories(data.completedCategories ?? CATEGORY_SETS[activeMode].length);
        } else {
          setError(data.error ?? "エラーが発生しました");
        }
        return;
      }

      setMessages([...nextMessages, { role: "assistant", content: data.reply }]);
      setCompletedCategories(data.completedCategories ?? 0);
      if (data.blocked) setBlocked(true);
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  function handleStart(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = specialty.trim();
    if (!trimmed || loading || !mode) return;
    const nextMessages: ChatMessage[] = [{ role: "user", content: trimmed }];
    setMessages(nextMessages);
    setStarted(true);
    void sendMessages(nextMessages, mode);
  }

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading || blocked || !mode) return;
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    void sendMessages(nextMessages, mode);
  }

  async function handlePreview() {
    if (!mode) return;
    setPreviewLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/interview/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, mode }),
      });
      const data = await res.json();

      if (!res.ok || !data.agentId) {
        setError(data.error ?? "要約の生成に失敗しました");
        return;
      }

      router.push(`/interview/preview/${data.agentId}`);
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setPreviewLoading(false);
    }
  }

  if (!mode) {
    return (
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md flex flex-col gap-4 rounded-xl border border-black/10 dark:border-white/15 p-6">
          <div>
            <h1 className="text-lg font-semibold">ヒアリングの深さを選んでください</h1>
            <p className="mt-1 text-sm text-black/60 dark:text-white/60">
              どちらのモードでも、あとから内容を確認できます。
            </p>
          </div>
          <button
            type="button"
            onClick={() => setMode("quick")}
            className="text-left rounded-lg border border-black/15 dark:border-white/20 p-4 hover:border-black/40 dark:hover:border-white/40"
          >
            <p className="text-sm font-semibold">さくっと作る(3問)</p>
            <p className="mt-1 text-xs text-black/60 dark:text-white/60">
              専門領域とその根拠 / よくある相談とその回答パターン / 口調やキャラクター
            </p>
          </button>
          <button
            type="button"
            onClick={() => setMode("full")}
            className="text-left rounded-lg border border-black/15 dark:border-white/20 p-4 hover:border-black/40 dark:hover:border-white/40"
          >
            <p className="text-sm font-semibold">しっかり作る(5カテゴリ全部)</p>
            <p className="mt-1 text-xs text-black/60 dark:text-white/60">
              上記3つに加えて、判断基準や暗黙知 / NGな回答・注意点も深掘りします
            </p>
          </button>
        </div>
      </main>
    );
  }

  if (!started) {
    return (
      <main className="flex flex-1 items-center justify-center p-6">
        <form
          onSubmit={handleStart}
          className="w-full max-w-md flex flex-col gap-4 rounded-xl border border-black/10 dark:border-white/15 p-6"
        >
          <div>
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-semibold">知識ヒアリングを始めましょう</h1>
              <button
                type="button"
                onClick={() => setMode(null)}
                className="text-xs underline text-black/50 dark:text-white/50"
              >
                モードを選び直す
              </button>
            </div>
            <p className="mt-1 text-sm text-black/60 dark:text-white/60">
              あなたの専門分野を教えてください。AIが質問しながら知識を整理します。
            </p>
          </div>
          <input
            autoFocus
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}
            placeholder="例: 中小企業向けの資金調達コンサルティング"
            className="rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:focus:border-white/40"
          />
          <button
            type="submit"
            disabled={!specialty.trim() || loading}
            className="rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium disabled:opacity-40"
          >
            {loading ? "送信中..." : "始める"}
          </button>
        </form>
      </main>
    );
  }

  const totalCategories = CATEGORY_SETS[mode].length;
  const currentQuestionNumber = Math.min(completedCategories + 1, totalCategories);
  const completed = completedCategories >= totalCategories;

  return (
    <main className="flex flex-1 flex-col max-w-2xl mx-auto w-full p-4">
      <div className="flex items-center justify-between border-b border-black/10 dark:border-white/15 py-2">
        <h1 className="text-base font-semibold">知識ヒアリング</h1>
        <span className="text-xs text-black/50 dark:text-white/50">
          質問 {currentQuestionNumber}/{totalCategories}
        </span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto py-4 flex flex-col gap-4">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
                m.role === "user"
                  ? "bg-foreground text-background"
                  : "bg-black/5 dark:bg-white/10"
              }`}
            >
              {displayText(m.content)}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-lg px-3 py-2 text-sm bg-black/5 dark:bg-white/10 text-black/50 dark:text-white/50">
              考え中...
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 pb-2">{error}</p>
      )}

      {completed && (
        <div className="rounded-lg border border-black/10 dark:border-white/15 p-4 mb-2 flex flex-col gap-2">
          <p className="text-sm font-medium">知識ベースの作成が完了しました。</p>
          <button
            type="button"
            onClick={handlePreview}
            disabled={previewLoading}
            className="self-start rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium disabled:opacity-40"
          >
            {previewLoading ? "要約を生成中..." : "プレビューを見る"}
          </button>
        </div>
      )}

      {blocked ? (
        <div className="rounded-lg border border-black/10 dark:border-white/15 p-4 flex flex-col gap-2">
          <p className="text-sm font-medium">
            無料プランでは3カテゴリまでのヒアリングをご利用いただけます。
          </p>
          <p className="text-sm text-black/60 dark:text-white/60">
            続きのヒアリングと知識ベースの完成には、Pro / Businessプランへのアップグレードが必要です。
          </p>
          <button
            type="button"
            onClick={() => setUpgradeModalOpen(true)}
            className="self-start rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium"
          >
            アップグレードする
          </button>
        </div>
      ) : (
        <form onSubmit={handleSend} className="flex gap-2 pt-2 border-t border-black/10 dark:border-white/15">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="回答を入力..."
            disabled={loading}
            className="flex-1 rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:focus:border-white/40 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium disabled:opacity-40"
          >
            送信
          </button>
        </form>
      )}

      <UpgradeModal open={upgradeModalOpen} onClose={() => setUpgradeModalOpen(false)} />
    </main>
  );
}
