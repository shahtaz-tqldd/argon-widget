import { SessionMessageIcon } from "../icons";
import { BaseHeader } from "../widget-header";

function formatSessionDate(value, now = Date.now()) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const elapsedMilliseconds = Math.max(0, now - date.getTime());
  const elapsedMinutes = Math.floor(elapsedMilliseconds / 60_000);

  if (elapsedMinutes < 1) return "just now";
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}h ago`;

  const elapsedDays = Math.floor(elapsedHours / 24);
  if (elapsedDays === 1) return "yesterday";
  if (elapsedDays < 30) return `${elapsedDays}d ago`;

  const elapsedMonths = Math.floor(elapsedDays / 30);
  if (elapsedMonths < 12) return `${elapsedMonths}mo ago`;

  const elapsedYears = Math.floor(elapsedDays / 365);
  return `${elapsedYears}y ago`;
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
    status: String(session.status || "unknown").toLowerCase(),
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
        <div className="argon-session-list">
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
                    ? `Open session ${details.shortId} with ${details.sender}`
                    : `Session ${details.shortId}, ${details.status}`
                }
              >
                <span className="argon-session-message-icon" aria-hidden="true">
                  <SessionMessageIcon />
                </span>
                <span className="argon-session-card-copy">
                  <span className="argon-session-card-topline">
                    <strong title={details.sender}>{details.sender}</strong>
                    <span
                      className={`argon-session-status argon-session-status--${details.status}`}
                    >
                      {details.status}
                    </span>
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
        </div>
        {error && (
          <p className="argon-lead-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
