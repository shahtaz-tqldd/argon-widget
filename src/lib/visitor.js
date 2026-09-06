const STORAGE_PREFIX = "argon_widget_conversation";
const VISITOR_STORAGE_PREFIX = "argon_widget_visitor";

function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `visitor-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createClientMessageId() {
  return createId();
}

export function getConversationToken(publicKey) {
  try {
    return localStorage.getItem(`${STORAGE_PREFIX}:${publicKey}`) || "";
  } catch {
    return "";
  }
}

export function saveConversationToken(publicKey, token) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}:${publicKey}`, token);
  } catch {
    // Private browsing or storage policy can disable localStorage.
  }
}

export function getVisitorRecord(publicKey) {
  try {
    const value = JSON.parse(
      localStorage.getItem(`${VISITOR_STORAGE_PREFIX}:${publicKey}`) || "null",
    );
    if (!value || typeof value !== "object") return null;
    return {
      visitorId: typeof value.visitorId === "string" ? value.visitorId : "",
      tokens: value.tokens && typeof value.tokens === "object" ? value.tokens : {},
    };
  } catch {
    return null;
  }
}

export function getSessionToken(publicKey, sessionId) {
  const token = getVisitorRecord(publicKey)?.tokens?.[sessionId];
  return typeof token === "string" ? token : "";
}

export function saveVisitorConversation(
  publicKey,
  { visitorId, sessionId, token },
) {
  if (!visitorId || !sessionId || !token) return;
  try {
    const current = getVisitorRecord(publicKey);
    localStorage.setItem(
      `${VISITOR_STORAGE_PREFIX}:${publicKey}`,
      JSON.stringify({
        visitorId,
        tokens: { ...(current?.tokens ?? {}), [sessionId]: token },
      }),
    );
  } catch {
    // Private browsing or storage policy can disable localStorage.
  }
}

export function clearConversationToken(publicKey, invalidToken = "") {
  try {
    const conversationKey = `${STORAGE_PREFIX}:${publicKey}`;
    if (!invalidToken || localStorage.getItem(conversationKey) === invalidToken) {
      localStorage.removeItem(conversationKey);
    }

    const record = getVisitorRecord(publicKey);
    if (record && invalidToken) {
      const tokens = Object.fromEntries(
        Object.entries(record.tokens).filter(([, token]) => token !== invalidToken),
      );
      localStorage.setItem(
        `${VISITOR_STORAGE_PREFIX}:${publicKey}`,
        JSON.stringify({ ...record, tokens }),
      );
    }
  } catch {
    // Nothing to clear when storage is unavailable.
  }
}
