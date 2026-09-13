import { useEffect, useMemo, useState } from "react";
import { resolveWidgetConfig } from "../config/widgetConfig";
import { useChat } from "../hooks/useChat";
import { CloseIcon } from "./icons";
import { ChatScreen } from "./screens/chat";
import { LeadFormScreen } from "./screens/get-started";
import { SessionListScreen } from "./screens/session-list";

const SCREENS = Object.freeze({
  CHAT: "chat",
  LEAD_FORM: "lead-form",
  SESSIONS: "sessions",
});

function chooseInitialScreen({
  sessions,
  canCollectLead,
  hasReusableLead,
  hasStoredConversation,
}) {
  if (sessions.length) return SCREENS.SESSIONS;
  if (canCollectLead && !hasReusableLead && !hasStoredConversation) {
    return SCREENS.LEAD_FORM;
  }
  return SCREENS.CHAT;
}

export function ChatWidget({ config: suppliedConfig = {} }) {
  const baseConfig = useMemo(
    () => resolveWidgetConfig(suppliedConfig),
    [suppliedConfig],
  );
  const {
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
    hasStoredConversation,
    hasConversation,
    conversation,
    start,
    send,
    leaveConversation,
    refreshVisitorHistory,
  } = useChat(baseConfig);
  const config = resolveWidgetConfig({ ...baseConfig, ...remoteConfig });
  const [isOpen, setIsOpen] = useState(false);
  const [selectedScreen, setScreen] = useState(null);
  const [startMode, setStartMode] = useState("initial");
  const [leadError, setLeadError] = useState("");
  const [sessionError, setSessionError] = useState("");

  const leadFields = (config.leadConfig?.fields ?? []).filter(
    (field) => field?.mode !== "hidden" && field?.value,
  );
  const canCollectLead = Boolean(
    config.leadConfig?.isEnabled &&
    config.leadConfig?.autoCollect &&
    leadFields.length,
  );
  const isReady = isConfigurationLoaded && isVisitorLoaded;
  const hasReusableLead = Boolean(visitor?.lead_id);
  const hasSessionHistory = visitorSessions.length > 0;
  const initialScreen = isReady
    ? chooseInitialScreen({
        sessions: visitorSessions,
        canCollectLead,
        hasReusableLead,
        hasStoredConversation,
      })
    : null;
  const screen = hasConversation
    ? SCREENS.CHAT
    : (selectedScreen ?? initialScreen);

  useEffect(() => {
    if (
      !isOpen ||
      !isReady ||
      screen !== SCREENS.CHAT ||
      hasConversation ||
      isStarting ||
      sessionError
    ) {
      return;
    }

    const resumeLegacyConversation =
      startMode === "initial" && hasStoredConversation && !visitor;
    start(
      resumeLegacyConversation
        ? undefined
        : { forceNew: true, leadId: visitor?.lead_id },
    ).catch((error) => {
      setSessionError(
        error.message || "The conversation could not be started.",
      );
    });
  }, [
    hasConversation,
    hasStoredConversation,
    isOpen,
    isReady,
    isStarting,
    screen,
    sessionError,
    start,
    startMode,
    visitor,
  ]);

  function toggleChat() {
    setIsOpen((current) => !current);
  }

  async function handleLeadSubmit(leadData) {
    setLeadError("");
    try {
      await start({ forceNew: true, leadData });
      setScreen(SCREENS.CHAT);
    } catch (error) {
      setLeadError(
        error.message || "We couldn't save your details. Please try again.",
      );
    }
  }

  async function handleResumeSession(session) {
    if (!session.conversationToken || session.status !== "open") return;
    setSessionError("");
    try {
      await start({ conversationToken: session.conversationToken });
      setScreen(SCREENS.CHAT);
    } catch (error) {
      setSessionError(
        error.message || "This conversation could not be resumed.",
      );
    }
  }

  function showNewSession(visitorValue = visitor) {
    leaveConversation();
    setLeadError("");
    setSessionError("");

    if (canCollectLead && !visitorValue?.lead_id) {
      setScreen(SCREENS.LEAD_FORM);
      return;
    }

    setStartMode("new");
    setScreen(SCREENS.CHAT);
  }

  async function handleStartNew() {
    const history = await refreshVisitorHistory().catch(() => null);
    showNewSession(history?.visitor ?? visitor);
  }

  async function showSessionHistory() {
    const history = await refreshVisitorHistory().catch(() => null);
    const sessions = history?.sessions ?? visitorSessions;
    if (!sessions.length) return;

    leaveConversation();
    setLeadError("");
    setSessionError("");
    setStartMode("initial");
    setScreen(SCREENS.SESSIONS);
  }

  function handleDownloadSession() {
    if (!conversation) return;
    const transcript = [
      `${config.name} conversation`,
      `Session: ${conversation.sessionId}`,
      "",
      `${config.name}: ${config.welcomeMessage}`,
      ...messages.map((message) => {
        const sender =
          message.sender === "visitor"
            ? "You"
            : message.sender === "system"
              ? "System"
              : message.senderName || config.name;
        let timestamp = "";
        if (message.createdAt) {
          try {
            timestamp = ` [${new Date(message.createdAt).toLocaleString(
              config.language,
            )}]`;
          } catch {
            timestamp = ` [${new Date(message.createdAt).toLocaleString()}]`;
          }
        }
        return `${sender}${timestamp}: ${message.content}`;
      }),
    ].join("\n");
    const url = URL.createObjectURL(
      new Blob([transcript], { type: "text/plain;charset=utf-8" }),
    );
    const link = document.createElement("a");
    const safeName = config.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    link.href = url;
    link.download = `${safeName || "chat"}-${conversation.sessionId}.txt`;
    link.hidden = true;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  const defaultHeaderDescription = !isReady
    ? "Loading…"
    : screen === SCREENS.SESSIONS
      ? "Choose a conversation"
      : screen === SCREENS.LEAD_FORM
        ? "Start a conversation"
        : isEnded
          ? "Conversation ended"
          : isStarting || !isConnected
            ? "Connecting…"
            : config.headerDescription;
  const headerDescription =
    onlineSupportCount > 0
      ? `${onlineSupportCount} human support ${onlineSupportCount === 1 ? "agent" : "agents"} online`
      : defaultHeaderDescription;
  const showBack = Boolean(
    isReady && screen !== SCREENS.SESSIONS && hasSessionHistory,
  );
  const screenHeaderProps = {
    title: config.name,
    description: headerDescription,
    showBack,
    isBusy: isStarting || !isReady,
    canDownload: hasConversation,
    canViewSessions: hasSessionHistory || Boolean(visitor),
    onBack: showSessionHistory,
    onStartNew: handleStartNew,
    onDownload: handleDownloadSession,
    onViewSessions: showSessionHistory,
  };
  const baseHeaderProps = { ...screenHeaderProps, logo: config.logo };

  return (
    <section
      className={`argon-widget argon-widget--${config.position} argon-widget--${config.theme}`}
      style={{
        "--argon-primary": config.primaryColor,
        "--argon-secondary": config.secondaryColor,
      }}
      aria-label={`${config.name} chat`}
      lang={config.language}
    >
      {isOpen && (
        <div
          className="argon-panel"
          role="dialog"
          aria-label={`${config.name} conversation`}
        >
          {!isReady || !screen ? (
            <ChatScreen
              config={config}
              headerProps={screenHeaderProps}
              messages={[]}
              isLoading
            />
          ) : screen === SCREENS.LEAD_FORM ? (
            <LeadFormScreen
              config={{
                ...config.leadConfig,
                introMessage:
                  config.leadConfig.introMessage || config.welcomeMessage,
              }}
              fields={leadFields}
              headerProps={baseHeaderProps}
              isSubmitting={isStarting}
              error={leadError}
              onSubmit={handleLeadSubmit}
            />
          ) : screen === SCREENS.SESSIONS ? (
            <SessionListScreen
              headerProps={baseHeaderProps}
              visitor={visitor}
              sessions={visitorSessions}
              isLoading={isStarting}
              error={sessionError}
              onResume={handleResumeSession}
              onStartNew={handleStartNew}
            />
          ) : (
            <ChatScreen
              config={config}
              headerProps={screenHeaderProps}
              messages={messages}
              isLoading={isStarting && !hasConversation}
              isSending={isSending}
              isResponding={isResponding}
              isEnded={isEnded}
              error={!hasConversation ? sessionError : ""}
              onRetry={() => setSessionError("")}
              onSend={send}
            />
          )}

          {config.showBranding && (
            <footer>
              Powered by <strong>Argon Chatbot</strong>
            </footer>
          )}
        </div>
      )}
      <div className="argon-launcher-row">
        {!isOpen && config.launcherText && (
          <span className="argon-launcher-text">{config.launcherText}</span>
        )}
        <button
          type="button"
          className="argon-launcher"
          onClick={toggleChat}
          aria-label={isOpen ? "Close chat" : "Open chat"}
          aria-expanded={isOpen}
        >
          {isOpen ? (
            <CloseIcon />
          ) : (
            <img
              src="/logo-dark.png"
              alt="Logo"
              style={{ width: "40px", height: "40px" }}
            />
          )}
        </button>
      </div>
    </section>
  );
}
