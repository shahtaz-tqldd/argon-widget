import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "../api/httpClient";
import { createWidgetApi } from "../api/widgetApi";
import { mapPublicConfiguration } from "../config/widgetConfig";
import {
  clearConversationToken,
  createClientMessageId,
  getConversationToken,
  getOrCreateVisitorId,
  getSessionToken,
  getVisitorRecord,
  saveConversationToken,
  saveVisitorConversation,
} from "../lib/visitor";

function normalizeMessage(message) {
  const senderType = String(
    message.sender_type ?? message.sender?.type ?? message.sender ?? "ai",
  ).toLowerCase();
  const senderDetails =
    message.sender && typeof message.sender === "object" ? message.sender : {};
  const isVisitor = senderType === "visitor";
  const isSystem = senderType === "system";
  const isAi = ["ai", "assistant", "bot", "chatbot"].includes(senderType);
  const sender = isVisitor
    ? "visitor"
    : isSystem
      ? "system"
      : isAi
        ? "ai"
        : "support";

  return {
    id: message.id,
    externalId: message.external_id || "",
    content: message.content,
    sender,
    senderName:
      senderDetails.name ||
      senderDetails.display_name ||
      message.sender_name ||
      message.metadata?.agent_name ||
      (typeof message.sender === "string" && !isAi
        ? message.sender
        : ""),
    senderAvatar:
      senderDetails.avatar ||
      senderDetails.avatar_url ||
      message.sender_avatar ||
      message.metadata?.agent_avatar ||
      "",
    status: message.status || "",
    createdAt: message.created_at,
    metadata:
      message.metadata && typeof message.metadata === "object"
        ? message.metadata
        : {},
    pending: false,
  };
}

function messagesFromPage(response) {
  const values = Array.isArray(response)
    ? response
    : response?.results ?? response?.messages ?? response?.items ?? [];

  return values
    .filter(
      (message) =>
        message?.id && typeof message.content === "string",
    )
    .map(normalizeMessage)
    .sort((left, right) => {
      const leftTime = Date.parse(left.createdAt || "");
      const rightTime = Date.parse(right.createdAt || "");
      if (!Number.isFinite(leftTime) || !Number.isFinite(rightTime)) return 0;
      return leftTime - rightTime;
    });
}

function messageFromEvent(payload) {
  return payload?.data?.message ?? payload?.message ?? payload?.data ?? null;
}

function upsertMessage(messages, incoming) {
  const index = messages.findIndex((message) =>
    message.id === incoming.id ||
    (incoming.externalId && (message.externalId === incoming.externalId || message.id === incoming.externalId)),
  );
  if (index === -1) return [...messages, incoming];
  const next = [...messages];
  next[index] = { ...messages[index], ...incoming };
  return next;
}

function systemMessage(content) {
  return { id: `system-${Date.now()}-${Math.random()}`, content, sender: "system" };
}

function fallbackWebsocketUrl(config, sessionId, token) {
  const baseUrl = config.socketUrl.replace(/^http/, "ws").replace(/\/$/, "");
  const publicKey = encodeURIComponent(config.publicKey);
  return `${baseUrl}/ws/widget/chatbots/${publicKey}/conversations/${sessionId}/?token=${encodeURIComponent(token)}`;
}

function conversationFromBootstrap(config, bootstrap, visitorId) {
  const session = bootstrap.session ?? {};
  const token = bootstrap.conversation_token;
  if (!session.id || !token) {
    throw new Error("The conversation response is missing a session or token.");
  }
  return {
    sessionId: session.id,
    token,
    websocketUrl:
      bootstrap.websocket_url ||
      fallbackWebsocketUrl(config, session.id, token),
    status: session.status,
    visitorId:
      bootstrap.visitor?.visitor_id ||
      bootstrap.visitor?.id ||
      session.visitor_id ||
      visitorId,
  };
}

function normalizeSession(config, session) {
  const conversationToken =
    session.conversation_token ||
    session.conversationToken ||
    getSessionToken(config.publicKey, session.id);

  return {
    ...session,
    status: String(session.status || "unknown").toLowerCase(),
    conversationToken,
    websocketUrl:
      session.websocket_url ||
      session.websocketUrl ||
      (conversationToken
        ? fallbackWebsocketUrl(config, session.id, conversationToken)
        : ""),
  };
}

export function useChat(config) {
  const visitorId = useMemo(
    () => getOrCreateVisitorId(config.publicKey),
    [config.publicKey],
  );
  const api = useMemo(
    () => createWidgetApi(config, visitorId),
    [config, visitorId],
  );
  const conversationRef = useRef(null);
  const startPromiseRef = useRef(null);
  const [remoteConfig, setRemoteConfig] = useState(null);
  const [isConfigurationLoaded, setIsConfigurationLoaded] = useState(false);
  const [visitor, setVisitor] = useState(null);
  const [visitorSessions, setVisitorSessions] = useState([]);
  const [isVisitorLoaded, setIsVisitorLoaded] = useState(false);
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isStarting, setIsStarting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isResponding, setIsResponding] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isEnded, setIsEnded] = useState(false);
  const [onlineSupportCount, setOnlineSupportCount] = useState(0);

  const loadVisitorHistory = useCallback(async (_visitorId, options = {}) => {
    const [visitorValue, sessionResponse] = await Promise.all([
      api.getVisitorDetails(options),
      api.getVisitorSessions(options),
    ]);
    const sessionValues = Array.isArray(sessionResponse)
      ? sessionResponse
      : sessionResponse?.results ?? sessionResponse?.sessions ?? [];
    const sessions = sessionValues.map((session) =>
      normalizeSession(config, session),
    );
    setVisitor(visitorValue);
    setVisitorSessions(sessions);
    return { visitor: visitorValue, sessions };
  }, [api, config]);

  useEffect(() => {
    if (!config.publicKey) return undefined;
    const controller = new AbortController();
    api.getConfiguration({ signal: controller.signal })
      .then((value) => setRemoteConfig(mapPublicConfiguration(value)))
      .catch((error) => {
        if (error.name !== "AbortError") {
          setMessages((current) => [...current, systemMessage("This chat is currently unavailable.")]);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsConfigurationLoaded(true);
      });
    return () => controller.abort();
  }, [api, config]);

  useEffect(() => {
    if (!config.publicKey) {
      setIsVisitorLoaded(true);
      return undefined;
    }
    const visitorId = getVisitorRecord(config.publicKey)?.visitorId;
    if (!visitorId) {
      setIsVisitorLoaded(true);
      return undefined;
    }

    const controller = new AbortController();
    loadVisitorHistory(visitorId, { signal: controller.signal })
      .catch((error) => {
        if (error.name !== "AbortError" && config.debug) {
          console.warn("[Argon] Visitor history could not be loaded", error);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsVisitorLoaded(true);
      });
    return () => controller.abort();
  }, [config, loadVisitorHistory]);

  const refreshVisitorHistory = useCallback(async () => {
    const visitorId =
      conversationRef.current?.visitorId ||
      getVisitorRecord(config.publicKey)?.visitorId;
    if (!visitorId) return null;
    setIsVisitorLoaded(false);
    try {
      return await loadVisitorHistory(visitorId);
    } finally {
      setIsVisitorLoaded(true);
    }
  }, [config.publicKey, loadVisitorHistory]);

  const start = useCallback(async ({
    conversationToken = null,
    session = null,
    leadData,
    forceNew = false,
  } = {}) => {
    if (conversationRef.current) return conversationRef.current;
    if (startPromiseRef.current) return startPromiseRef.current;
    if (!config.publicKey) throw new Error("A chatbot public key is required.");

    setIsStarting(true);
    startPromiseRef.current = (async () => {
      const storedToken = forceNew
        ? ""
        : conversationToken || getConversationToken(config.publicKey);

      // A session was explicitly picked from the session list. Resolve it
      // directly with its own token: visitor/create/ ignores the token and
      // always returns the visitor's most recent session.
      if (conversationToken && session?.id) {
        const sessionStatus = String(session.status || "unknown").toLowerCase();
        const value = {
          sessionId: session.id,
          token: conversationToken,
          websocketUrl:
            session.websocketUrl ||
            fallbackWebsocketUrl(config, session.id, conversationToken),
          status: sessionStatus,
          visitorId,
        };
        const history = await api.getConversationMessages({
          sessionId: value.sessionId,
          conversationToken: value.token,
        });
        saveConversationToken(config.publicKey, value.token);
        saveVisitorConversation(config.publicKey, value);
        conversationRef.current = value;
        setConversation(value);
        setIsEnded(sessionStatus === "closed");
        setMessages(messagesFromPage(history));
        return value;
      }

      let bootstrap;
      try {
        bootstrap =
          forceNew && !leadData
            ? await api.createSession()
            : await api.startConversation({
                conversationToken: storedToken,
                leadData,
              });
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 401 || !storedToken) throw error;
        clearConversationToken(config.publicKey, storedToken);
        bootstrap = await api.startConversation({ leadData });
      }

      const value = conversationFromBootstrap(config, bootstrap, visitorId);
      const history = bootstrap.messages ?? [];
      saveConversationToken(config.publicKey, value.token);
      saveVisitorConversation(config.publicKey, value);
      conversationRef.current = value;
      setConversation(value);
      setIsEnded(value.status === "closed");
      setMessages(history.map(normalizeMessage));
      void loadVisitorHistory(value.visitorId).catch((error) => {
        if (config.debug) {
          console.warn("[Argon] Visitor history could not be refreshed", error);
        }
      });
      return value;
    })();

    try {
      return await startPromiseRef.current;
    } finally {
      startPromiseRef.current = null;
      setIsStarting(false);
    }
  }, [api, config, loadVisitorHistory, visitorId]);

  const bookAppointment = useCallback(
    async ({ startsAt, collectedFields }) => {
      const activeConversation = await start();
      return api.bookAppointment({
        sessionId: activeConversation.sessionId,
        conversationToken: activeConversation.token,
        startsAt,
        collectedFields,
      });
    },
    [api, start],
  );

  const leaveConversation = useCallback(() => {
    conversationRef.current = null;
    setConversation(null);
    setMessages([]);
    setIsSending(false);
    setIsResponding(false);
    setIsConnected(false);
    setIsEnded(false);
  }, []);

  const refreshConversation = useCallback(async () => {
    const current = conversationRef.current;
    if (!current) return null;

    let bootstrap;
    try {
      bootstrap = await api.startConversation({
        conversationToken: current.token,
      });
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
      clearConversationToken(config.publicKey, current.token);
      bootstrap = await api.startConversation();
    }

    const value = conversationFromBootstrap(config, bootstrap, visitorId);
    saveConversationToken(config.publicKey, value.token);
    saveVisitorConversation(config.publicKey, value);
    conversationRef.current = value;
    setConversation(value);
    setIsEnded(value.status === "closed");
    if (value.sessionId !== current.sessionId) {
      setMessages((bootstrap.messages ?? []).map(normalizeMessage));
    }
    return value;
  }, [api, config, visitorId]);

  useEffect(() => {
    if (!conversation?.websocketUrl || isEnded) return undefined;
    let active = true;
    let socket;
    let reconnectTimer;
    let heartbeatTimer;
    let attempts = 0;

    function connect() {
      if (!active) return;
      socket = new WebSocket(conversation.websocketUrl);
      socket.addEventListener("open", () => {
        attempts = 0;
        setIsConnected(true);
        heartbeatTimer = window.setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "ping" }));
        }, 25000);
      });
      socket.addEventListener("message", (event) => {
        let payload;
        try {
          payload = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
          if (typeof payload === "string") payload = JSON.parse(payload);
        } catch (error) {
          if (config.debug) console.error("[Argon] Invalid socket event", event.data, error);
          return;
        }
        window.dispatchEvent(new CustomEvent("argon:socket-event", { detail: payload }));
        if (config.debug) console.debug("[Argon] Socket event", payload);
        const data = payload.data ?? {};

        if (payload.type === "connection.ready") {
          const status = data.status || "open";
          const value = { ...conversationRef.current, status };
          conversationRef.current = value;
          setConversation(value);
          setIsEnded(status === "closed");
        } else if (payload.type === "presence.count") {
          const count = Number(data.online_count);
          if (Number.isFinite(count)) {
            setOnlineSupportCount(Math.max(0, Math.floor(count)));
          }
        } else if (payload.type === "message.created") {
          const eventMessage = messageFromEvent(payload);
          if (!eventMessage?.id || typeof eventMessage.content !== "string") {
            if (config.debug) console.warn("[Argon] Malformed message.created event", payload);
            return;
          }
          const message = normalizeMessage(eventMessage);
          setMessages((current) => upsertMessage(current, message));
          if (message.sender !== "visitor") setIsResponding(false);
        } else if (payload.type === "message.accepted") {
          setIsSending(false);
        } else if (payload.type === "ai.response.started") {
          setIsResponding(true);
        } else if (payload.type === "ai.response.failed") {
          setIsResponding(false);
          setMessages((current) => [...current, systemMessage("We couldn't generate a reply. Please try again.")]);
        } else if (
          typeof payload.type === "string" &&
          payload.type.startsWith("session.")
        ) {
          const status = data.status || payload.type.slice("session.".length);
          const value = { ...conversationRef.current, status };
          conversationRef.current = value;
          setConversation(value);
          setIsEnded(payload.type === "session.closed" || status === "closed");
          setIsResponding(false);
        } else if (payload.type === "error") {
          setIsSending(false);
          setIsResponding(false);
          setMessages((current) => [...current, systemMessage(data.message || "The message could not be sent.")]);
        }
      });
      socket.addEventListener("close", async (event) => {
        window.clearInterval(heartbeatTimer);
        setIsConnected(false);
        if (!active) return;
        if (event.code === 4401) {
          try {
            const previousUrl = conversationRef.current?.websocketUrl;
            const refreshed = await refreshConversation();
            if (active && refreshed?.websocketUrl === previousUrl) {
              reconnectTimer = window.setTimeout(connect, 1000);
            }
          } catch (error) {
            if (config.debug) {
              console.warn("[Argon] Conversation token could not be refreshed", error);
            }
            setMessages((current) => [
              ...current,
              systemMessage("Your chat session expired. Please start again."),
            ]);
            setIsEnded(true);
          }
          return;
        }
        if ([4403, 4404].includes(event.code)) {
          if (event.code === 4404 && conversationRef.current?.token) {
            clearConversationToken(
              config.publicKey,
              conversationRef.current.token,
            );
          }
          setMessages((current) => [
            ...current,
            systemMessage(
              event.code === 4403
                ? "This chat is not available from this site."
                : "This conversation is no longer available.",
            ),
          ]);
          setIsEnded(true);
          return;
        }
        attempts += 1;
        reconnectTimer = window.setTimeout(connect, Math.min(1000 * 2 ** attempts, 15000));
      });
      socket.addEventListener("error", () => socket.close());
    }

    connect();
    return () => {
      active = false;
      window.clearTimeout(reconnectTimer);
      window.clearInterval(heartbeatTimer);
      socket?.close();
    };
  }, [
    config.debug,
    config.publicKey,
    conversation?.websocketUrl,
    isEnded,
    refreshConversation,
  ]);

  const send = useCallback(async (content, attachments = []) => {
    const text = String(content ?? "").trim();
    const files = (Array.isArray(attachments) ? attachments : []).filter(
      (file) => file && typeof file.name === "string",
    );
    if ((!text && files.length === 0) || isSending || isEnded) return;
    if (text.length > 10000) {
      setMessages((current) => [
        ...current,
        systemMessage("Messages can be at most 10,000 characters."),
      ]);
      return;
    }
    const attachmentLines = files.map((file) => `📎 ${file.name}`);
    const displayContent = [text, ...attachmentLines]
      .filter(Boolean)
      .join("\n");
    const clientMessageId = createClientMessageId();
    setMessages((current) => [...current, {
      id: clientMessageId,
      externalId: clientMessageId,
      content: displayContent,
      sender: "visitor",
      status: "sending",
      createdAt: new Date().toISOString(),
      pending: true,
    }]);
    setIsSending(true);

    try {
      const activeConversation = await start();
      const response = await api.sendMessage({
        content: text || files.map((file) => file.name).join(", "),
        attachments: files.map(({ name, type, size }) => ({
          name,
          type,
          size,
        })),
        sessionId: activeConversation.sessionId,
        conversationToken: activeConversation.token,
        clientMessageId,
      });
      setMessages((current) => upsertMessage(current, normalizeMessage(response.message)));
    } catch (error) {
      setMessages((current) => [
        ...current.filter((message) => message.id !== clientMessageId),
        systemMessage(error.message || "We couldn't send that message. Please try again."),
      ]);
    } finally {
      setIsSending(false);
    }
  }, [api, isEnded, isSending, start]);

  return {
    messages,
    isStarting,
    isSending,
    isResponding,
    isConnected,
    isEnded,
    onlineSupportCount,
    remoteConfig,
    isConfigurationLoaded,
    visitor,
    visitorSessions,
    isVisitorLoaded,
    hasStoredVisitor: Boolean(getVisitorRecord(config.publicKey)?.visitorId),
    hasStoredConversation: Boolean(getConversationToken(config.publicKey)),
    hasConversation: Boolean(conversation),
    conversation,
    start,
    send,
    bookAppointment,
    leaveConversation,
    refreshVisitorHistory,
  };
}
