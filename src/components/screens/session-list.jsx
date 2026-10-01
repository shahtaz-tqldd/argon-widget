import { SessionMessageIcon } from "../icons";
import { ScrollContainer } from "../ui/scroll-container";
import { BaseHeader } from "../widget-header";

const SESSION_DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function formatSessionDate(value, now = Date.now()) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const elapsedMilliseconds = Math.max(0, now - date.getTime());
  const elapsedMinutes = Math.floor(elapsedMilliseconds / 60_000);

  if (elapsedMinutes < 1) return "just now";
  if (elapsedMinutes < 60) {
    return elapsedMinutes === 1
      ? "1 minute ago"
      : `${elapsedMinutes} minutes ago`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) {
    return elapsedHours === 1 ? "1 hour ago" : `${elapsedHours} hours ago`;
  }

  const elapsedDays = Math.floor(elapsedHours / 24);
  if (elapsedDays === 1) return "yesterday";
  if (elapsedDays < 7) return `${elapsedDays} days ago`;
  if (elapsedDays < 14) return "1 week ago";

  return SESSION_DATE_FORMAT.format(date);
}

function getSessionDetails(session) {
  const lastMessage = session.last_message ?? {};
  const activityDate =
    lastMessage.created_at || session.last_activity_at || session.created_at;
  const messageCount = Number(session.message_count);

  return {
    sender:
      typeof lastMessage.sender === "string" && lastMessage.sender.trim()
        ? lastMessage.sender.trim()
        : "Conversation",
    preview:
      typeof lastMessage.content === "string" && lastMessage.content.trim()
        ? lastMessage.content.trim()
        : "No messages yet",
    activityDate,
    activityLabel: formatSessionDate(activityDate),
    messageCount: Number.isFinite(messageCount)
      ? Math.max(0, Math.floor(messageCount))
      : 0,
    shortId: String(session.id || "")
      .slice(0, 8)
      .toUpperCase(),
  };
}

export function SessionListScreen({
  headerProps,
  visitor,
  sessions,
  isLoading,
  error,
  onResume,
  onStartNew,
}) {
  return (
    <div className="argon-session-screen">
      <BaseHeader {...headerProps} />
      <div className="argon-session-home">
        <div className="argon-session-heading">
          <strong>
            Welcome back
            {visitor?.lead_data?.name ? `, ${visitor.lead_data.name}` : ""}
          </strong>
          <span>Continue a conversation or start a new one.</span>
        </div>
        <button
          type="button"
          className="argon-new-session"
          disabled={isLoading}
          onClick={onStartNew}
        >
          {isLoading ? "Opening..." : "Start a new conversation"}
        </button>
        <ScrollContainer className="argon-session-list">
          {!sessions.length && !isLoading && (
            <p className="argon-session-empty">No conversations yet.</p>
          )}
          {sessions.map((session) => {
            const canOpen = Boolean(session.conversationToken);
            const details = getSessionDetails(session);
            const messageLabel = `${details.messageCount} ${details.messageCount === 1 ? "message" : "messages"}`;

            return (
              <button
                key={session.id}
                type="button"
                className="argon-session-card"
                disabled={!canOpen || isLoading}
                onClick={() => onResume(session)}
                aria-label={
                  canOpen
                    ? `Continue conversation with ${details.sender}`
                    : `Conversation ${details.shortId} is unavailable`
                }
              >
                <span className="argon-session-message-icon" aria-hidden="true">
                  <SessionMessageIcon />
                </span>
                <span className="argon-session-card-copy">
                  <span className="argon-session-card-topline">
                    <strong title={details.sender}>{details.sender}</strong>
                  </span>
                  <span className="argon-session-preview">
                    {details.preview}
                  </span>
                  <span className="argon-session-meta">
                    {details.activityLabel && (
                      <>
                        <time dateTime={details.activityDate}>
                          {details.activityLabel}
                        </time>
                        <span aria-hidden="true">&bull;</span>
                      </>
                    )}
                    <span>{messageLabel}</span>
                  </span>
                </span>
              </button>
            );
          })}
        </ScrollContainer>
        {error && (
          <p className="argon-lead-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
