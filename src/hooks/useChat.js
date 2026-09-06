import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "../api/httpClient";
import { createWidgetApi } from "../api/widgetApi";
import { mapPublicConfiguration } from "../config/widgetConfig";
import {
  clearConversationToken,
  createClientMessageId,
  getConversationToken,
  getSessionToken,
  getVisitorRecord,
  saveConversationToken,
  saveVisitorConversation,
} from "../lib/visitor";

function normalizeMessage(message) {
  const senderType = message.sender_type ?? message.sender;
  return {
    id: message.id,
    externalId: message.external_id || "",
    content: message.content,
    sender: senderType === "visitor" ? "visitor" : senderType === "system" ? "system" : "bot",
    senderName: message.sender?.name || "",
    senderAvatar: message.sender?.avatar || "",
    createdAt: message.created_at,
    pending: false,
  };
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

export function useChat(config) {
  const api = useMemo(() => createWidgetApi(config), [config]);
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

  const loadVisitorHistory = useCallback(async (visitorId, options = {}) => {
    const [visitorValue, sessionValues] = await Promise.all([
      api.getVisitor(visitorId, options),
      api.getVisitorSessions(visitorId, options),
    ]);
    setVisitor(visitorValue);
    setVisitorSessions(
      (Array.isArray(sessionValues) ? sessionValues : []).map((session) => ({
        ...session,
        conversationToken:
          session.conversation_token ||
          getSessionToken(config.publicKey, session.id),
      })),
    );
    return { visitor: visitorValue, sessions: sessionValues };
  }, [api, config.publicKey]);

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
    leadData,
    leadId,
    forceNew = false,
  } = {}) => {
    if (conversationRef.current) return conversationRef.current;
    if (startPromiseRef.current) return startPromiseRef.current;
    if (!config.publicKey) throw new Error("A chatbot public key is required.");

    setIsStarting(true);
    startPromiseRef.current = (async () => {
      const explicitlySelected = Boolean(conversationToken);
      const storedToken = forceNew
        ? ""
        : conversationToken || getConversationToken(config.publicKey);
      let bootstrap;
      try {
        bootstrap = await api.startConversation({
          conversationToken: storedToken,
          leadData,
          leadId,
        });
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 401 || !storedToken) throw error;
        clearConversationToken(config.publicKey, storedToken);
        if (explicitlySelected) throw error;
        bootstrap = await api.startConversation({ leadData, leadId });
      }

      const value = {
        sessionId: bootstrap.session.id,
        token: bootstrap.conversation_token,
        websocketUrl: bootstrap.websocket_url || fallbackWebsocketUrl(
          config,
          bootstrap.session.id,
          bootstrap.conversation_token,
        ),
        status: bootstrap.session.status,
        visitorId: bootstrap.session.visitor_id,
      };
      saveConversationToken(config.publicKey, value.token);
      saveVisitorConversation(config.publicKey, value);
      conversationRef.current = value;
      setConversation(value);
      setIsEnded(["resolved", "closed"].includes(value.status));
      setMessages((bootstrap.messages ?? []).map(normalizeMessage));
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
  }, [api, config, loadVisitorHistory]);

  const leaveConversation = useCallback(() => {
    conversationRef.current = null;
    setConversation(null);
    setMessages([]);
    setIsSending(false);
    setIsResponding(false);
    setIsConnected(false);
    setIsEnded(false);
  }, []);

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

        if (payload.type === "message.created") {
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
        } else if (["session.resolved", "session.closed"].includes(payload.type)) {
          setIsEnded(true);
          setIsResponding(false);
        } else if (payload.type === "error") {
          setIsSending(false);
          setIsResponding(false);
          setMessages((current) => [...current, systemMessage(data.message || "The message could not be sent.")]);
        }
      });
      socket.addEventListener("close", (event) => {
        window.clearInterval(heartbeatTimer);
        setIsConnected(false);
        if (!active || [4401, 4403, 4404].includes(event.code)) return;
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
  }, [config.debug, conversation?.websocketUrl, isEnded]);

  const send = useCallback(async (content) => {
    const text = content.trim();
    if (!text || isSending || isEnded) return;
    const clientMessageId = createClientMessageId();
    setMessages((current) => [...current, {
      id: clientMessageId,
      externalId: clientMessageId,
      content: text,
      sender: "visitor",
      pending: true,
    }]);
    setIsSending(true);

    try {
      const activeConversation = await start();
      const response = await api.sendMessage({
        content: text,
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
    remoteConfig,
    isConfigurationLoaded,
    visitor,
    visitorSessions,
    isVisitorLoaded,
    hasStoredConversation: Boolean(getConversationToken(config.publicKey)),
    hasConversation: Boolean(conversation),
    conversation,
    start,
    send,
    leaveConversation,
    refreshVisitorHistory,
  };
}
