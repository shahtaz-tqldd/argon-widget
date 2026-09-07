import { useEffect, useRef, useState } from "react";
import { LeftIcon, MenuIcon } from "./icons";

export function WidgetHeader({
  title,
  description,
  showBack,
  isBusy,
  canDownload,
  canViewSessions,
  onBack,
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
    <header className="argon-header">
      {showBack && (
        <button
          type="button"
          className="argon-icon-button argon-back-button"
          disabled={isBusy}
          onClick={onBack}
          aria-label="Back"
        >
          <LeftIcon />
        </button>
      )}
      <div className="argon-header-copy">
        <strong>{title}</strong>
        <span>
          <i />
          {description}
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
              Download the session
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={!canViewSessions || isBusy}
              onClick={() => runMenuAction(onViewSessions)}
            >
              View past sessions
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
