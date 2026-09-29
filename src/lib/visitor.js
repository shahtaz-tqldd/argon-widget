const STORAGE_PREFIX = "argon_widget_conversation";
const VISITOR_STORAGE_PREFIX = "argon_widget_visitor";
const VISITOR_COOKIE_PREFIX = "argon_widget_visitor_";
const VISITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `visitor-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createClientMessageId() {
  return createId();
}

function getVisitorCookieName(publicKey) {
  return `${VISITOR_COOKIE_PREFIX}${encodeURIComponent(publicKey)}`;
}

function getVisitorIdFromCookie(publicKey) {
  if (typeof document === "undefined") return "";
  const cookieName = `${getVisitorCookieName(publicKey)}=`;
  const cookie = document.cookie
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(cookieName));
  if (!cookie) return "";
  try {
    return decodeURIComponent(cookie.slice(cookieName.length));
  } catch {
    return "";
  }
}

function saveVisitorIdCookie(publicKey, visitorId) {
  if (typeof document === "undefined" || !visitorId) return;
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? "; Secure"
      : "";
  document.cookie = `${getVisitorCookieName(publicKey)}=${encodeURIComponent(visitorId)}; Max-Age=${VISITOR_COOKIE_MAX_AGE}; Path=/; SameSite=Lax${secure}`;
}

function getStoredVisitorData(publicKey) {
  try {
    const value = JSON.parse(
      localStorage.getItem(`${VISITOR_STORAGE_PREFIX}:${publicKey}`) ||
        "null",
    );
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

export function getOrCreateVisitorId(publicKey) {
  const existingVisitorId = getVisitorRecord(publicKey)?.visitorId;
  if (existingVisitorId) return existingVisitorId;

  return globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID().replaceAll("-", "")
    : createId();
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
  const stored = getStoredVisitorData(publicKey);
  let visitorId = getVisitorIdFromCookie(publicKey);

  // Migrate visitors created by older widget versions from localStorage.
  if (!visitorId && typeof stored.visitorId === "string" && stored.visitorId) {
    visitorId = stored.visitorId;
    saveVisitorIdCookie(publicKey, visitorId);
  }

  if (!visitorId) return null;
  return {
    visitorId,
    tokens:
      stored.tokens && typeof stored.tokens === "object" ? stored.tokens : {},
  };
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
  saveVisitorIdCookie(publicKey, visitorId);
  try {
    const current = getVisitorRecord(publicKey);
    localStorage.setItem(
      `${VISITOR_STORAGE_PREFIX}:${publicKey}`,
      JSON.stringify({
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
        JSON.stringify({ tokens }),
      );
    }
  } catch {
    // Nothing to clear when storage is unavailable.
  }
}
