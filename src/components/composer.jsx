import { useEffect, useRef, useState } from "react";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";
import { CloseIcon, MicIcon, PaperclipIcon, SendIcon, SmileIcon } from "./icons";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_FILE_COUNT = 5;
const ACCEPT_ATTRIBUTE = ".pdf,.doc,.docx,.xls,.xlsx,.csv,image/*";
const DOCUMENT_EXTENSIONS = new Set([
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "csv",
]);

const EMOJIS = [
  "\u{1F600}", "\u{1F603}", "\u{1F604}", "\u{1F601}", "\u{1F606}",
  "\u{1F605}", "\u{1F923}", "\u{1F602}", "\u{1F642}", "\u{1F609}",
  "\u{1F60A}", "\u{1F60D}", "\u{1F929}", "\u{1F618}", "\u{1F61C}",
  "\u{1F914}", "\u{1F917}", "\u{1F92B}", "\u{1F634}", "\u{1F60C}",
  "\u{1F973}", "\u{1F60E}", "\u{1F913}", "\u{1FA7A}", "\u{1F622}",
  "\u{1F62D}", "\u{1F624}", "\u{1F92F}", "\u{1F631}", "\u{1F91D}",
  "\u{1F44D}", "\u{1F44E}", "\u{1F44F}", "\u{1F64F}", "\u{1F4AA}",
  "\u{1F44B}", "\u270C\uFE0F", "\u{1F91A}", "\u{1F389}", "\u2764\uFE0F",
  "\u{1F49B}", "\u{1F49A}", "\u{1F499}", "\u{1F90D}", "\u2728",
  "\u{2B50}", "\u{1F525}", "\u{1F4A1}", "\u{1F381}", "\u2615",
  "\u26A1", "\u2705", "\u274C",
];

function getFileExtension(name) {
  const match = /\.([a-z0-9]+)$/i.exec(name);
  return match ? match[1].toLowerCase() : "";
}

function isAcceptedFile(file) {
  if (file.type && file.type.startsWith("image/")) return true;
  return DOCUMENT_EXTENSIONS.has(getFileExtension(file.name));
}

function formatFileSize(size) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function getAttachmentBadge(file) {
  if (file.type && file.type.startsWith("image/")) {
    return "argon-attachment-badge--image";
  }
  const extension = getFileExtension(file.name);
  if (extension === "pdf") return "argon-attachment-badge--pdf";
  if (extension === "doc" || extension === "docx") {
    return "argon-attachment-badge--doc";
  }
  if (extension === "xls" || extension === "xlsx" || extension === "csv") {
    return "argon-attachment-badge--sheet";
  }
  return "argon-attachment-badge--file";
}

function getAttachmentBadgeLabel(file) {
  if (file.type && file.type.startsWith("image/")) return "img";
  return getFileExtension(file.name) || "file";
}

export function MessageComposer({ config, isSending, isEnded, onSend }) {
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [attachmentError, setAttachmentError] = useState("");
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const emojiButtonRef = useRef(null);
  const emojiPickerRef = useRef(null);

  const supportsVoiceInput =
    typeof window !== "undefined" &&
    Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

  const {
    interimTranscript,
    finalTranscript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
    isMicrophoneAvailable,
  } = useSpeechRecognition();

  const canUseVoice =
    supportsVoiceInput &&
    browserSupportsSpeechRecognition !== false &&
    isMicrophoneAvailable !== false;

  const dictationSuffix = finalTranscript
    ? `${draft && !draft.endsWith(" ") ? " " : ""}${finalTranscript} `
    : "";
  const composedValue = draft + dictationSuffix;

  function commitDictation() {
    if (finalTranscript) {
      setDraft(composedValue);
      resetTranscript();
    }
  }

  useEffect(() => {
    if (!attachmentError) return undefined;
    const timer = window.setTimeout(() => setAttachmentError(""), 4000);
    return () => window.clearTimeout(timer);
  }, [attachmentError]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [composedValue]);

  useEffect(() => {
    if (!isEmojiOpen) return undefined;

    function closePicker(event) {
      if (event.key === "Escape") {
        setIsEmojiOpen(false);
      } else if (
        event.type === "pointerdown" &&
        !emojiPickerRef.current?.contains(event.target) &&
        !emojiButtonRef.current?.contains(event.target)
      ) {
        setIsEmojiOpen(false);
      }
    }

    document.addEventListener("keydown", closePicker);
    document.addEventListener("pointerdown", closePicker);
    return () => {
      document.removeEventListener("keydown", closePicker);
      document.removeEventListener("pointerdown", closePicker);
    };
  }, [isEmojiOpen]);

  function insertEmoji(emoji) {
    const textarea = textareaRef.current;
    if (!textarea) {
      setDraft((current) => current + emoji);
      return;
    }
    const start = Math.min(textarea.selectionStart ?? draft.length, draft.length);
    const end = Math.min(textarea.selectionEnd ?? start, draft.length);
    setDraft(draft.slice(0, start) + emoji + draft.slice(end));
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + emoji.length;
    });
  }

  function handleFilesSelected(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    const accepted = [];
    let error = "";

    for (const file of files) {
      if (!isAcceptedFile(file)) {
        error = `${file.name} is not a supported file type.`;
      } else if (file.size > MAX_FILE_SIZE) {
        error = `${file.name} is larger than 5 MB.`;
      } else {
        accepted.push(file);
      }
    }

    const room = Math.max(0, MAX_FILE_COUNT - attachments.length);
    if (accepted.length > room) {
      error = `You can attach up to ${MAX_FILE_COUNT} files.`;
    }
    setAttachments([...attachments, ...accepted.slice(0, room)]);
    setAttachmentError(error);
  }

  function removeAttachment(index) {
    setAttachments((current) => current.filter((_, i) => i !== index));
  }

  function toggleDictation() {
    if (listening) {
      SpeechRecognition.stopListening();
      commitDictation();
      return;
    }
    resetTranscript();
    SpeechRecognition.startListening({
      continuous: true,
      ...(config.language ? { language: config.language } : {}),
    });
  }

  function handleDraftChange(event) {
    const value = event.target.value;
    if (finalTranscript && value.endsWith(dictationSuffix)) {
      setDraft(value.slice(0, value.length - dictationSuffix.length));
      return;
    }
    resetTranscript();
    setDraft(value);
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (listening) SpeechRecognition.stopListening();
    const text = composedValue.trim();
    if (!text && attachments.length === 0) return;
    if (isSending || isEnded) return;
    onSend(text, attachments);
    setDraft("");
    setAttachments([]);
    setIsEmojiOpen(false);
    resetTranscript();
  }

  const canSubmit =
    (composedValue.trim().length > 0 || attachments.length > 0) &&
    !isSending &&
    !isEnded;

  return (
    <form className="argon-composer" onSubmit={handleSubmit}>
      {attachments.length > 0 && (
        <div className="argon-composer-attachments">
          {attachments.map((file, index) => (
            <span
              className="argon-attachment-chip"
              key={`${file.name}-${file.size}-${index}`}
            >
              <span
                className={`argon-attachment-badge ${getAttachmentBadge(file)}`}
              >
                {getAttachmentBadgeLabel(file)}
              </span>
              <span className="argon-attachment-chip-name" title={file.name}>
                {file.name}
              </span>
              <span className="argon-attachment-chip-size">
                {formatFileSize(file.size)}
              </span>
              <button
                type="button"
                aria-label={`Remove ${file.name}`}
                onClick={() => removeAttachment(index)}
              >
                <CloseIcon />
              </button>
            </span>
          ))}
        </div>
      )}
      {attachmentError && (
        <p className="argon-composer-error" role="alert">
          {attachmentError}
        </p>
      )}
      {canUseVoice && listening && (
        <div className="argon-composer-dictation" aria-live="polite">
          <span className="argon-composer-dictation-dot" />
          <span className="argon-composer-dictation-text">
            Listening&hellip; {interimTranscript}
          </span>
          <button type="button" onClick={toggleDictation}>
            Stop
          </button>
        </div>
      )}
      <div className="argon-composer-field">
        <label className="argon-sr-only" htmlFor="argon-message">
          Message
        </label>
        <textarea
          id="argon-message"
          ref={textareaRef}
          rows="1"
          maxLength={10000}
          value={composedValue}
          disabled={isEnded}
          placeholder={
            isEnded ? "This conversation has ended" : config.placeholder
          }
          onChange={handleDraftChange}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) handleSubmit(event);
          }}
        />

        {isEmojiOpen && (
          <div
            className="argon-emoji-picker"
            role="menu"
            aria-label="Emoji"
            ref={emojiPickerRef}
          >
            {EMOJIS.map((emoji) => (
              <button key={emoji} type="button" onClick={() => insertEmoji(emoji)}>
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="argon-composer-toolbar">
        <div className="argon-composer-actions">
          <button
            ref={emojiButtonRef}
            type="button"
            className="argon-composer-icon"
            aria-label="Insert emoji"
            aria-haspopup="menu"
            aria-expanded={isEmojiOpen}
            disabled={isEnded}
            onClick={() => setIsEmojiOpen((current) => !current)}
          >
            <SmileIcon />
          </button>
          <button
            type="button"
            className="argon-composer-icon"
            aria-label="Attach file"
            title="PDF, Word, Excel, CSV or image (max 5 MB)"
            disabled={isEnded}
            onClick={() => fileInputRef.current?.click()}
          >
            <PaperclipIcon />
          </button>
          {canUseVoice && (
            <button
              type="button"
              className={`argon-composer-icon argon-composer-mic${listening ? " argon-composer-mic--active" : ""}`}
              aria-label={listening ? "Stop voice input" : "Start voice input"}
              aria-pressed={listening}
              disabled={isEnded}
              onClick={toggleDictation}
            >
              <MicIcon />
            </button>
          )}
        </div>

        <button
          type="submit"
          className="argon-composer-send"
          disabled={!canSubmit}
          aria-label="Send message"
        >
          <SendIcon />
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        multiple
        hidden
        onChange={handleFilesSelected}
      />
    </form>
  );
}
