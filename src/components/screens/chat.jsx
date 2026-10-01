import { useEffect, useRef } from "react";
import { MessageComposer } from "../composer";
import { ChatbotAvatar } from "../ui/avatar";
import { ScrollContainer } from "../ui/scroll-container";
import { ChatHeader } from "../widget-header";

function parseMessageDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getDateKey(value) {
  const date = parseMessageDate(value);
  if (!date) return "";
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatDateDivider(value, language) {
  const date = parseMessageDate(value);
  if (!date) return "";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const messageDay = new Date(date);
  messageDay.setHours(0, 0, 0, 0);
  const elapsedDays = Math.round(
    (today.getTime() - messageDay.getTime()) / 86_400_000,
  );

  if (elapsedDays === 0) return "Today";
  if (elapsedDays === 1) return "Yesterday";
  if (elapsedDays > 1 && elapsedDays < 7) {
    return new Intl.DateTimeFormat(language, { weekday: "long" }).format(date);
  }

  return new Intl.DateTimeFormat(language, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatMessageTime(value, language) {
  const date = parseMessageDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat(language, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatStatus(value) {
  if (!value) return "";
  const status = String(value).replaceAll("_", " ");
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function getSenderKey(message, assistantName) {
  if (message.sender === "support") {
    return `support:${message.senderName || ""}:${message.senderAvatar || ""}`;
  }
  if (message.sender === "ai" || message.sender === "bot") {
    return `ai:${assistantName}`;
  }
  return message.sender;
}

function getInitials(name) {
  return String(name || "Support")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function SupportAvatar({ name, src }) {
  return (
    <span className="argon-message-avatar" aria-hidden="true">
      <span>{getInitials(name)}</span>
      {src && (
        <img
          src={src}
          alt=""
          onError={(event) => {
            event.currentTarget.hidden = true;
          }}
        />
      )}
    </span>
  );
}

function MessageTimeline({ config, messages }) {
  const assistantName = config.chatbotName || config.name || "Assistant";
  const firstMessageDate = messages.find(
    (message) => message.createdAt,
  )?.createdAt;
  const timeline = [
    {
      id: "argon-welcome-message",
      sender: "ai",
      senderName: assistantName,
      content: config.welcomeMessage,
      createdAt: firstMessageDate || new Date().toISOString(),
      status: "",
    },
    ...messages,
  ];

  return timeline.map((message, index) => {
    const previousMessage = timeline[index - 1];
    const nextMessage = timeline[index + 1];
    const dateKey = getDateKey(message.createdAt);
    const previousDateKey = getDateKey(previousMessage?.createdAt);
    const startsNewDate = !previousMessage || dateKey !== previousDateKey;
    const startsSenderGroup =
      startsNewDate ||
      !previousMessage ||
      previousMessage.sender === "system" ||
      getSenderKey(previousMessage, assistantName) !==
        getSenderKey(message, assistantName);
    const isSystem = message.sender === "system";
    const isSupport = message.sender === "support";
    const isAssistant = message.sender === "ai" || message.sender === "bot";
    const senderName = isSupport
      ? message.senderName || "Support"
      : assistantName;
    const time = formatMessageTime(message.createdAt, config.language);
    const status = formatStatus(message.status);
    const nextTime = formatMessageTime(
      nextMessage?.createdAt,
      config.language,
    );
    const nextStatus = formatStatus(nextMessage?.status);
    const sharesMetadataWithNext =
      nextMessage &&
      nextMessage.sender !== "system" &&
      dateKey === getDateKey(nextMessage.createdAt) &&
      getSenderKey(message, assistantName) ===
        getSenderKey(nextMessage, assistantName) &&
      time === nextTime &&
      status === nextStatus;
    const showMetadata = (time || status) && !sharesMetadataWithNext;

    return (
      <div className="argon-message-entry" key={message.id}>
        {startsNewDate && dateKey && (
          <div className="argon-message-date">
            <span>{formatDateDivider(message.createdAt, config.language)}</span>
          </div>
        )}

        {isSystem ? (
          <div className="argon-message argon-message--system">
            {message.content}
          </div>
        ) : (
          <div
            className={[
              "argon-message-row",
              `argon-message-row--${message.sender}`,
              !startsSenderGroup && "argon-message-row--continuation",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {(isSupport || isAssistant) &&
              (isSupport ? (
                <SupportAvatar
                  name={senderName}
                  src={message.senderAvatar}
                />
              ) : (
                <ChatbotAvatar chatbot={config} size="xs" alt="" />
              ))}
            <div className="argon-message-stack">
              {startsSenderGroup && (isSupport || isAssistant) && (
                <strong className="argon-message-name">{senderName}</strong>
              )}
              <div
                className={`argon-message argon-message--${message.sender}`}
              >
                {message.content}
              </div>
              {showMetadata && (
                <div className="argon-message-meta">
                  {time && (
                    <time dateTime={message.createdAt} title={message.createdAt}>
                      {time}
                    </time>
                  )}
                  {time && status && <span aria-hidden="true">&middot;</span>}
                  {status && <span>{status}</span>}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  });
}

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
  const messageEndRef = useRef(null);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  let content;

  if (isLoading) {
    content = (
      <ScrollContainer className="argon-messages" aria-live="polite">
        <MessageTimeline config={config} messages={[]} />
        <div className="argon-typing" aria-label="Loading chat">
          <i />
          <i />
          <i />
        </div>
      </ScrollContainer>
    );
  } else if (error) {
    content = (
      <div className="argon-session-home argon-start-error">
        <strong>We couldn't start the conversation</strong>
        <span>{error}</span>
        <button type="button" className="argon-new-session" onClick={onRetry}>
          Try again
        </button>
      </div>
    );
  } else {
    content = (
      <>
        <ScrollContainer className="argon-messages" aria-live="polite">
          <MessageTimeline config={config} messages={messages} />
          {(isSending || isResponding) && (
            <div className="argon-typing" aria-label="Assistant is typing">
              <i />
              <i />
              <i />
            </div>
          )}
          <div ref={messageEndRef} />
        </ScrollContainer>
        <MessageComposer
          config={config}
          isSending={isSending}
          isEnded={isEnded}
          onSend={onSend}
        />
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
