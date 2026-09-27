const CHATBOT_AVATAR_SIZES = new Set(["xs", "sm", "md", "lg", "xl"]);

const ChatbotAvatar = ({
  chatbot = null,
  src = null,
  size = "lg",
  className = "",
  alt = "Chatbot logo",
}) => {
  const logoSrc = chatbot?.logo || src;
  const avatarSize = CHATBOT_AVATAR_SIZES.has(size) ? size : "lg";
  const classes = [
    "argon-chatbot-avatar",
    `argon-chatbot-avatar--${avatarSize}`,
    !logoSrc && "argon-chatbot-avatar--fallback",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes}>
      {logoSrc ? (
        <img
          src={logoSrc}
          alt={alt}
          onError={(event) => {
            const image = event.currentTarget;
            if (!image.src.endsWith("/logo-dark.png")) {
              image.parentElement?.classList.add(
                "argon-chatbot-avatar--fallback",
              );
              image.src = "/logo-dark.png";
            }
          }}
        />
      ) : (
        <img src="/logo-dark.png" alt={alt} />
      )}
    </span>
  );
};

export { ChatbotAvatar };
