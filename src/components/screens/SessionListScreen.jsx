function formatSessionDate(value, language) {
  if (!value) return "Previous conversation";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Previous conversation";

  try {
    return new Intl.DateTimeFormat(language || "en", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

export function SessionListScreen({
  visitor,
  sessions,
  language,
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
                <strong>
                  {session.status === "open"
                    ? "Open conversation"
                    : "Past conversation"}
                </strong>
                <small>
                  {formatSessionDate(
                    session.last_activity_at || session.created_at,
                    language,
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
      <button
        type="button"
        className="argon-new-session"
        disabled={isLoading}
        onClick={onStartNew}
      >
        {isLoading ? "Opening…" : "Start a new conversation"}
      </button>
    </div>
  );
}
