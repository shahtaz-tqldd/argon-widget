import { useEffect, useMemo, useRef, useState } from "react";
import { resolveWidgetConfig } from "../config/widgetConfig";
import { useChat } from "../hooks/useChat";
import { ChatIcon, CloseIcon, SendIcon } from "./icons";

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
    start,
    send,
  } = useChat(baseConfig);
  const config = resolveWidgetConfig({ ...baseConfig, ...remoteConfig });
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const messageEndRef = useRef(null);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  function handleSubmit(event) {
    event.preventDefault();
    if (!draft.trim()) return;
    send(draft);
    setDraft("");
  }

  function toggleChat() {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);
    if (nextOpen) start().catch(() => {});
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
                  : isStarting || !isConnected
                    ? "Connecting…"
                    : config.headerDescription}
              </span>
            </div>
            <button
              type="button"
              className="argon-icon-button"
              onClick={() => setIsOpen(false)}
              aria-label="Close chat"
            >
              <CloseIcon />
            </button>
          </header>
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
          {isOpen ? <CloseIcon /> : <ChatIcon />}
        </button>
      </div>
    </section>
  );
}
