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

function getSessionPreview(session) {
  const sender = session.last_message?.sender?.trim();
  const content = session.last_message?.content?.trim();

  if (!content) return "No messages yet";
  return sender ? `${sender}: ${content}` : content;
}

export function SessionListScreen({
  visitor,
  sessions,
  isLoading,
  error,
  onResume,
  onStartNew,
}) {
  return (
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
        {isLoading ? "Opening…" : "Start a new conversation"}
      </button>
      <div className="argon-session-list">
        {sessions.map((session) => {
          const canResume = Boolean(
            session.status === "open" && session.conversationToken,
          );
          return (
            <button
              key={session.id}
              type="button"
              className="argon-session-card"
              disabled={!canResume || isLoading}
              onClick={() => onResume(session)}
            >
              <span className="argon-session-card-copy">
                <span>{getSessionPreview(session)}</span>
                <small>
                  {formatSessionDate(
                    session.last_activity_at || session.created_at,
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
      {error && (
        <p className="argon-lead-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
