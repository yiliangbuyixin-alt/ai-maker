import "server-only";
import { createHash, randomBytes } from "crypto";

const KEY_PREFIX = "sk_agent_";

export function generateApiKey(): string {
  return `${KEY_PREFIX}${randomBytes(24).toString("base64url")}`;
}

// API keys are high-entropy random tokens, not user-chosen secrets, so an
// unsalted SHA-256 lookup hash is the standard (and sufficient) approach —
// the same one GitHub/Stripe use for personal access tokens. This is not
// the right approach for passwords.
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}
