import { useEffect, useMemo, useRef, useState } from "react";
import { resolveWidgetConfig } from "../config/widgetConfig";
import { useChat } from "../hooks/useChat";
import { ChatIcon, CloseIcon, MenuIcon, SendIcon } from "./icons";
import { FloatingInput } from "./ui/input";

function formatSessionDate(value, language) {
  if (!value) return "Previous conversation";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Previous conversation";
  return new Intl.DateTimeFormat(language || "en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
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
  const [draft, setDraft] = useState("");
  const [isConsentAccepted, setIsConsentAccepted] = useState(false);
  const [leadError, setLeadError] = useState("");
  const [sessionError, setSessionError] = useState("");
  const [flow, setFlow] = useState("home");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const messageEndRef = useRef(null);
  const menuRef = useRef(null);
  const leadFields = (config.leadConfig?.fields ?? []).filter(
    (field) => field?.mode !== "hidden" && field?.value,
  );
  const canCollectLead = Boolean(
    config.leadConfig?.isEnabled &&
    config.leadConfig?.autoCollect &&
    leadFields.length,
  );
  const hasReusableLead = Boolean(visitor?.lead_id);
  const hasSessionHistory = visitorSessions.length > 0;
  const isReady = isConfigurationLoaded && isVisitorLoaded;
  const shouldShowSessions = Boolean(
    isReady &&
    !hasConversation &&
    hasSessionHistory &&
    flow === "home",
  );
  const shouldCollectLead = Boolean(
    isReady &&
    !hasConversation &&
    canCollectLead &&
    !hasReusableLead &&
    (flow === "new" || (!hasSessionHistory && !hasStoredConversation)),
  );

  useEffect(() => {
    if (
      !isOpen ||
      !isReady ||
      hasConversation ||
      isStarting ||
      shouldShowSessions ||
      shouldCollectLead ||
      sessionError
    ) return;

    const resumeLegacyConversation = hasStoredConversation && !visitor;
    start(
      resumeLegacyConversation
        ? undefined
        : { forceNew: true, leadId: visitor?.lead_id },
    ).catch((error) => {
      setSessionError(error.message || "The conversation could not be started.");
    });
  }, [
    hasConversation,
    hasStoredConversation,
    isOpen,
    isReady,
    isStarting,
    sessionError,
    shouldCollectLead,
    shouldShowSessions,
    start,
    visitor,
  ]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  useEffect(() => {
    if (!isMenuOpen) return undefined;

    function closeMenu(event) {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
        return;
      }
      if (
        event.type === "pointerdown" &&
        !event.composedPath().includes(menuRef.current)
      ) {
        setIsMenuOpen(false);
      }
    }

    document.addEventListener("keydown", closeMenu);
    document.addEventListener("pointerdown", closeMenu);
    return () => {
      document.removeEventListener("keydown", closeMenu);
      document.removeEventListener("pointerdown", closeMenu);
    };
  }, [isMenuOpen]);

  function handleSubmit(event) {
    event.preventDefault();
    if (!draft.trim()) return;
    send(draft);
    setDraft("");
  }

  function toggleChat() {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);
    if (!nextOpen) setIsMenuOpen(false);
  }

  async function handleLeadSubmit(event) {
    event.preventDefault();
    if (config.leadConfig?.requireConsent && !isConsentAccepted) return;
    setLeadError("");
    const formData = new FormData(event.currentTarget);
    const leadData = Object.fromEntries(
      leadFields.map((field) => [
        field.value,
        String(formData.get(field.value) ?? "").trim(),
      ]),
    );

    try {
      await start({ forceNew: true, leadData });
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
    } catch (error) {
      setSessionError(
        error.message || "This conversation could not be resumed.",
      );
    }
  }

  function handleNewSession() {
    setSessionError("");
    setIsConsentAccepted(false);
    setFlow("new");
  }

  async function handleStartNewFromMenu() {
    setIsMenuOpen(false);
    await refreshVisitorHistory().catch(() => null);
    leaveConversation();
    setDraft("");
    handleNewSession();
  }

  async function handleViewPastSessions() {
    setIsMenuOpen(false);
    await refreshVisitorHistory().catch(() => null);
    leaveConversation();
    setDraft("");
    setSessionError("");
    setFlow("home");
  }

  function handleDownloadSession() {
    if (!conversation) return;
    setIsMenuOpen(false);
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
        const timestamp = message.createdAt
          ? ` [${new Date(message.createdAt).toLocaleString(config.language)}]`
          : "";
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
          <header className="argon-header">
            <span className="argon-avatar">
              {config.logo ? <img src={config.logo} alt="" /> : <ChatIcon />}
            </span>
            <div>
              <strong>{config.name}</strong>
              <span>
                <i />
                {isEnded
                  ? "Conversation ended"
                  : !hasConversation && isReady
                    ? shouldShowSessions
                      ? "Choose a conversation"
                      : "Start a conversation"
                  : isStarting || !isConnected
                    ? "Connecting…"
                    : config.headerDescription}
              </span>
            </div>
            <div className="argon-header-menu" ref={menuRef}>
              <button
                type="button"
                className="argon-icon-button"
                onClick={() => setIsMenuOpen((current) => !current)}
                aria-label="Conversation menu"
                aria-haspopup="menu"
                aria-expanded={isMenuOpen}
              >
                <MenuIcon />
              </button>
              {isMenuOpen && (
                <div className="argon-menu" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    disabled={isStarting}
                    onClick={handleStartNewFromMenu}
                  >
                    Start a new session
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={!hasConversation || isStarting}
                    onClick={handleDownloadSession}
                  >
                    Download the session
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={
                      isStarting || (!visitor && !hasStoredConversation)
                    }
                    onClick={handleViewPastSessions}
                  >
                    View past sessions
                  </button>
                </div>
              )}
            </div>
          </header>
          {!isReady || (isStarting && !hasConversation) ? (
            <div className="argon-messages" aria-live="polite">
              <div className="argon-message argon-message--bot">
                {config.welcomeMessage}
              </div>
              <div className="argon-typing" aria-label="Loading chat">
                <i />
                <i />
                <i />
              </div>
            </div>
          ) : shouldShowSessions ? (
            <div className="argon-session-home">
              <div className="argon-session-heading">
                <strong>
                  Welcome back
                  {visitor?.lead_data?.name
                    ? `, ${visitor.lead_data.name}`
                    : ""}
                </strong>
                <span>Continue a conversation or start a new one.</span>
              </div>
              <div className="argon-session-list">
                {visitorSessions.map((session) => {
                  const canResume = Boolean(
                    session.status === "open" && session.conversationToken,
                  );
                  return (
                    <button
                      key={session.id}
                      type="button"
                      className="argon-session-card"
                      disabled={!canResume || isStarting}
                      onClick={() => handleResumeSession(session)}
                    >
                      <span className="argon-session-card-copy">
                        <strong>
                          {session.status === "open"
                            ? "Open conversation"
                            : "Past conversation"}
                        </strong>
                        <small>
                          {formatSessionDate(
                            session.last_activity_at || session.created_at,
                            config.language,
                          )}
                        </small>
                      </span>
                      <span
                        className={`argon-session-status argon-session-status--${session.status}`}
                      >
                        {canResume ? "Continue" : session.status}
                      </span>
                    </button>
                  );
                })}
              </div>
              {sessionError && (
                <p className="argon-lead-error" role="alert">
                  {sessionError}
                </p>
              )}
              <button
                type="button"
                className="argon-new-session"
                onClick={handleNewSession}
              >
                Start a new conversation
              </button>
            </div>
          ) : shouldCollectLead ? (
            <form className="argon-lead-form" onSubmit={handleLeadSubmit}>
              <div className="argon-message argon-message--bot">
                {config.leadConfig.introMessage || config.welcomeMessage}
              </div>
              <div className="argon-lead-fields">
                {leadFields.map((field, index) => {
                  const inputId = `argon-lead-${index}`;
                  const inputType = [
                    "email",
                    "number",
                    "tel",
                    "text",
                    "url",
                  ].includes(field.type)
                    ? field.type
                    : "text";
                  return (
                    <FloatingInput
                      key={field.value}
                      id={inputId}
                      name={field.value}
                      label={field.label || field.value}
                      type={inputType}
                      required={field.mode === "required"}
                      optional={field.mode === "optional"}
                      autoComplete={field.value}
                      disabled={isStarting}
                    />
                  );
                })}
              </div>
              {config.leadConfig.requireConsent && (
                <label className="argon-consent" htmlFor="argon-lead-consent">
                  <input
                    id="argon-lead-consent"
                    type="checkbox"
                    checked={isConsentAccepted}
                    required
                    disabled={isStarting}
                    onChange={(event) =>
                      setIsConsentAccepted(event.target.checked)
                    }
                  />
                  <span>
                    {config.leadConfig.consentMessage ||
                      "I agree to the collection of my information."}
                  </span>
                </label>
              )}
              {leadError && (
                <p className="argon-lead-error" role="alert">
                  {leadError}
                </p>
              )}
              <button
                type="submit"
                disabled={
                  isStarting ||
                  (config.leadConfig.requireConsent && !isConsentAccepted)
                }
                className="!rounded-full"
              >
                {isStarting ? "Starting chat…" : "Start chat"}
              </button>
            </form>
          ) : !hasConversation && sessionError ? (
            <div className="argon-session-home argon-start-error">
              <strong>We couldn’t start the conversation</strong>
              <span>{sessionError}</span>
              <button
                type="button"
                className="argon-new-session"
                onClick={() => setSessionError("")}
              >
                Try again
              </button>
            </div>
          ) : (
            <div className="argon-messages" aria-live="polite">
              <div className="argon-message argon-message--bot">
                {config.welcomeMessage}
              </div>
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`argon-message argon-message--${message.sender}`}
                >
                  {message.content}
                </div>
              ))}
              {(isSending || isResponding) && (
                <div className="argon-typing" aria-label="Assistant is typing">
                  <i />
                  <i />
                  <i />
                </div>
              )}
              <div ref={messageEndRef} />
            </div>
          )}
          {hasConversation && (
            <form className="argon-composer" onSubmit={handleSubmit}>
              <label className="argon-sr-only" htmlFor="argon-message">
                Message
              </label>
              <textarea
                id="argon-message"
                rows="1"
                value={draft}
                disabled={isEnded}
                placeholder={
                  isEnded ? "This conversation has ended" : config.placeholder
                }
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey)
                    handleSubmit(event);
                }}
              />
              <button
                type="submit"
                disabled={!draft.trim() || isSending || isEnded}
                aria-label="Send message"
              >
                <SendIcon />
              </button>
            </form>
          )}
          {config.showBranding && (
            <footer>
              Powered by{" "}
              <strong className="font-bold text-primary">Argon Chatbot</strong>
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
