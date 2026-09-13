import { createRoot } from "react-dom/client";
import widgetStyles from "../styles/widget.css?inline";
import { ChatWidget } from "../components/chat-widget";
import { configFromElement, resolveWidgetConfig } from "../config/widgetConfig";

const ELEMENT_NAME = "argon-chat-widget";

class ArgonChatElement extends HTMLElement {
  connectedCallback() {
    if (this.root) return;
    const shadow = this.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    const mountPoint = document.createElement("div");
    style.textContent = widgetStyles;
    shadow.append(style, mountPoint);
    this.root = createRoot(mountPoint);
    this.root.render(<ChatWidget config={configFromElement(this)} />);
  }

  disconnectedCallback() {
    this.root?.unmount();
    this.root = null;
  }
}

if (!customElements.get(ELEMENT_NAME)) customElements.define(ELEMENT_NAME, ArgonChatElement);

function mount(config = {}) {
  const element = document.createElement(ELEMENT_NAME);
  const resolved = resolveWidgetConfig(config);
  Object.entries(resolved).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      element.dataset[key === "publicKey" ? "chatbot" : key] = String(value);
    }
  });
  document.body.appendChild(element);
  return element;
}

window.ArgonChatbot = { ...(window.ArgonChatbot || {}), mount };

const loaderScript = document.currentScript;
if (loaderScript?.dataset.chatbot && loaderScript.dataset.autoInit !== "false") {
  const start = () => mount(configFromElement(loaderScript));
  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start, { once: true });
}

export { ArgonChatElement, mount };
