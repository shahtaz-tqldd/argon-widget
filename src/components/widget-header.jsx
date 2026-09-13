import { useEffect, useRef, useState } from "react";
import { LeftIcon, MenuIcon } from "./icons";

function BackButton({ isBusy, onBack }) {
  return (
    <button
      type="button"
      className="argon-icon-button argon-back-button"
      disabled={isBusy}
      onClick={onBack}
      aria-label="Back"
    >
      <LeftIcon />
    </button>
  );
}

function HeaderCopy({ title, description }) {
  return (
    <div className="argon-header-copy">
      <strong>{title}</strong>
      <span>
        <i />
        {description}
      </span>
    </div>
  );
}

function HeaderMenu({
  isBusy,
  canDownload,
  canViewSessions,
  onStartNew,
  onDownload,
  onViewSessions,
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!isMenuOpen) return undefined;

    function closeMenu(event) {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      } else if (
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

  function runMenuAction(action) {
    setIsMenuOpen(false);
    action();
  }

  return (
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
            disabled={isBusy}
            onClick={() => runMenuAction(onStartNew)}
          >
            Start a new session
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={!canDownload || isBusy}
            onClick={() => runMenuAction(onDownload)}
          >
            Download transcript
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={!canViewSessions || isBusy}
            onClick={() => runMenuAction(onViewSessions)}
          >
            Report
          </button>
        </div>
      )}
    </div>
  );
}

export function ChatHeader({
  title,
  description,
  showBack,
  showMenu = true,
  ...actionProps
}) {
  return (
    <header className="argon-header argon-chat-header">
      {showBack && <BackButton {...actionProps} />}
      <HeaderCopy title={title} description={description} />
      {showMenu && <HeaderMenu {...actionProps} />}
    </header>
  );
}

export function BaseHeader({ title, description, logo }) {
  return (
    <header className="argon-header argon-base-header">
      <span className="argon-avatar">
        <img
          src={logo || "/logo.png"}
          alt=""
          onError={(event) => {
            const image = event.currentTarget;
            if (!image.src.endsWith("/logo.png")) image.src = "/logo.png";
          }}
        />
      </span>
      <HeaderCopy title={title} description={description} />
    </header>
  );
}
