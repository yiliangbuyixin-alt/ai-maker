export type Plan = "free" | "pro" | "business";

export type InterviewMode = "quick" | "full";

// Ordered category lists per mode. Order matters: it's the order the
// interview asks about them in, and the order sections render in.
export const CATEGORY_SETS: Record<InterviewMode, readonly string[]> = {
  quick: ["専門領域とその根拠", "よくある相談とその回答パターン", "口調やキャラクター"],
  full: [
    "専門領域とその根拠",
    "よくある相談とその回答パターン",
    "判断基準や暗黙知",
    "NGな回答・注意点",
    "口調やキャラクター",
  ],
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type InterviewSummary = {
  specialty: string;
  expertiseAndBasis: string;
  commonConsultations: string;
  // Only present when the interview ran in "full" mode.
  judgmentCriteria?: string;
  ngPoints?: string;
  toneAndCharacter: string;
};
