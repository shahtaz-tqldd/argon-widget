import { useEffect, useRef, useState } from "react";
import { SendIcon } from "../icons";
import { ChatHeader } from "../widget-header";

export function ChatScreen({
  config,
  headerProps,
  messages,
  isLoading,
  isSending,
  isResponding,
  isEnded,
  error,
  onRetry,
  onSend,
}) {
  const [draft, setDraft] = useState("");
  const messageEndRef = useRef(null);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  function handleSubmit(event) {
    event.preventDefault();
    if (!draft.trim()) return;
    onSend(draft);
    setDraft("");
  }

  let content;

  if (isLoading) {
    content = (
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
    );
  } else if (error) {
    content = (
      <div className="argon-session-home argon-start-error">
        <strong>We couldn’t start the conversation</strong>
        <span>{error}</span>
        <button type="button" className="argon-new-session" onClick={onRetry}>
          Try again
        </button>
      </div>
    );
  } else {
    content = (
      <>
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
              if (event.key === "Enter" && !event.shiftKey) handleSubmit(event);
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
      </>
    );
  }

  return (
    <div className="argon-chat-screen">
      <ChatHeader {...headerProps} />
      {content}
    </div>
  );
}
