const STORAGE_PREFIX = "argon_widget_conversation";

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

export function clearConversationToken(publicKey) {
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}:${publicKey}`);
  } catch {
    // Nothing to clear when storage is unavailable.
  }
}
