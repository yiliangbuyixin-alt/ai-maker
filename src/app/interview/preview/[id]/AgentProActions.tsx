"use client";

import { useState, useSyncExternalStore } from "react";
import UpgradeModal from "@/components/UpgradeModal";
import type { Plan } from "@/lib/types";

type AgentStatus = "active" | "published";

const noopSubscribe = () => () => {};

// window.location.origin doesn't exist during SSR — useSyncExternalStore is
// React's sanctioned way to read a browser-only value like this without a
// hydration mismatch (server snapshot is "", client snapshot is the real
// origin, and React reconciles the two automatically post-hydration).
function useOrigin(): string {
  return useSyncExternalStore(
    noopSubscribe,
    () => window.location.origin,
    () => "",
  );
}

export default function AgentProActions({
  agentId,
  plan,
  initialStatus,
  hasApiKey,
}: {
  agentId: string;
  plan: Plan;
  initialStatus: AgentStatus;
  hasApiKey: boolean;
}) {
  const [status, setStatus] = useState<AgentStatus>(initialStatus);
  const [gatedFeature, setGatedFeature] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [copied, setCopied] = useState(false);

  const [keyIssued, setKeyIssued] = useState(hasApiKey);
  const [issuingKey, setIssuingKey] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [keyCopied, setKeyCopied] = useState(false);

  const publicPath = `/a/${agentId}`;
  const origin = useOrigin();
  const publicUrl = origin ? `${origin}${publicPath}` : publicPath;

  async function handlePublishToggle() {
    if (plan === "free") {
      setGatedFeature("Web公開");
      return;
    }

    setPublishing(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/agents/${agentId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publish: status !== "published" }),
      });
      const data = await res.json();

      if (!res.ok) {
        setNotice(data.error ?? "エラーが発生しました");
        return;
      }

      setStatus(data.status);
    } catch {
      setNotice("通信エラーが発生しました");
    } finally {
      setPublishing(false);
    }
  }

  async function handleIssueApiKey() {
    if (plan === "free") {
      setGatedFeature("API発行");
      return;
    }

    if (keyIssued) {
      const confirmed = window.confirm(
        "再発行すると、既存のAPIキーは即座に無効になります。よろしいですか？",
      );
      if (!confirmed) return;
    }

    setIssuingKey(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/agents/${agentId}/api-key`, { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setNotice(data.error ?? "エラーが発生しました");
        return;
      }

      setRevealedKey(data.apiKey);
      setKeyIssued(true);
    } catch {
      setNotice("通信エラーが発生しました");
    } finally {
      setIssuingKey(false);
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function handleCopyKey() {
    if (!revealedKey) return;
    await navigator.clipboard.writeText(revealedKey);
    setKeyCopied(true);
    setTimeout(() => setKeyCopied(false), 1500);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handlePublishToggle}
          disabled={publishing}
          className="rounded-md border border-black/15 dark:border-white/20 px-3 py-2 text-sm font-medium hover:border-black/40 dark:hover:border-white/40 disabled:opacity-50"
        >
          {status === "published" ? "公開を停止" : "Web公開"}
        </button>
        <button
          type="button"
          onClick={handleIssueApiKey}
          disabled={issuingKey}
          className="rounded-md border border-black/15 dark:border-white/20 px-3 py-2 text-sm font-medium hover:border-black/40 dark:hover:border-white/40 disabled:opacity-50"
        >
          {keyIssued ? "APIキーを再発行" : "APIキーを発行"}
        </button>
      </div>

      {status === "published" && (
        <div className="flex items-center gap-2 text-xs">
          <a
            href={publicPath}
            target="_blank"
            rel="noreferrer"
            className="truncate underline text-black/60 dark:text-white/60"
          >
            {publicUrl}
          </a>
          <button
            type="button"
            onClick={handleCopy}
            className="shrink-0 rounded border border-black/15 dark:border-white/20 px-2 py-1 hover:border-black/40 dark:hover:border-white/40"
          >
            {copied ? "コピーしました" : "コピー"}
          </button>
        </div>
      )}

      {revealedKey && (
        <div className="flex flex-col gap-1 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
          <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
            このAPIキーは今だけ表示されます。安全な場所に保存してください。
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-black/5 px-2 py-1 text-xs dark:bg-white/10">
              {revealedKey}
            </code>
            <button
              type="button"
              onClick={handleCopyKey}
              className="shrink-0 rounded border border-black/15 dark:border-white/20 px-2 py-1 text-xs hover:border-black/40 dark:hover:border-white/40"
            >
              {keyCopied ? "コピーしました" : "コピー"}
            </button>
          </div>
          <p className="text-xs text-black/50 dark:text-white/50">
            使い方: <code>Authorization: Bearer {"<APIキー>"}</code> を付けて{" "}
            <code>POST /api/v1/chat</code> を呼び出してください。
          </p>
        </div>
      )}

      {keyIssued && !revealedKey && (
        <p className="text-xs text-black/50 dark:text-white/50">
          APIキーは発行済みです(セキュリティのため再表示はできません。必要な場合は再発行してください)。
        </p>
      )}

      {notice && <p className="text-xs text-black/50 dark:text-white/50">{notice}</p>}

      <UpgradeModal
        open={gatedFeature !== null}
        onClose={() => setGatedFeature(null)}
        featureName={gatedFeature ?? undefined}
      />
    </div>
  );
}
