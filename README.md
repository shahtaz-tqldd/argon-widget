# Argon Chatbot Widget

An embeddable React chat widget distributed as one JavaScript file. It uses
Shadow DOM so client-site styles do not leak into the chat UI and widget styles
do not affect the host page.

## Local development

```bash
npm install
cp .env.example .env
npm run dev
```

The development page is a visual playground. Build the client-ready script with:

```bash
npm run build
```

The output is `dist/argon-widget.js`.

## Embed

```html
<script
  src="https://cdn.argon.chat/widget.js"
  data-chatbot="your-public-chatbot-key"
  async
></script>
```

The API host comes from `VITE_APP_BASE_URL` at build time. It can be overridden
for a particular installation with `data-api-url`. The widget can also be
mounted manually:

```html
<script src="https://cdn.example.com/argon-widget.js"></script>
<script>
  ArgonChatbot.mount({
    publicKey: "your-public-chatbot-key",
    apiUrl: "https://api.example.com/api/v1",
    primaryColor: "#6d5dfc",
    position: "right",
  });
</script>
```

## Environment

- `VITE_APP_BASE_URL`: REST API root.
- `VITE_APP_SOCKET_URL`: WebSocket service root, reserved for the live visitor
  conversation transport. The backend-provided bootstrap URL takes precedence.

Do not put private credentials in Vite environment variables. Every `VITE_*`
value is shipped to the browser.

## Conversation lifecycle

The widget fetches public configuration using the script's `data-chatbot` key.
Opening it creates or resumes a conversation and connects to the WebSocket URL
returned by the backend. The signed 30-day conversation token is kept in browser
storage under a key scoped to that chatbot. Messages are submitted over REST
with the bearer token; AI and agent responses arrive through WebSocket events.

## Structure

```text
src/
  api/          HTTP transport and public widget API adapter
  components/   Presentational widget UI
  config/       Environment and embed configuration
  hooks/        Conversation state
  lib/          Browser utilities
  styles/       Isolated widget styles
  widget/       Embeddable custom-element entry point
```

```
(async () => {
  const RefreshRuntime = (
    await import("http://localhost:5175/@react-refresh")
  ).default;

  RefreshRuntime.injectIntoGlobalHook(window);
  window.$RefreshReg$ = () => {};
  window.$RefreshSig$ = () => (type) => type;
  window.__vite_plugin_react_preamble_installed__ = true;

  window.addEventListener("argon:socket-event", ({ detail }) => {
    console.log("[Argon socket received]", detail);
  });

  const { mount } = await import(
    `http://localhost:5175/src/widget/index.jsx?t=${Date.now()}`
  );

  document
    .querySelectorAll("argon-chat-widget")
    .forEach((widget) => widget.remove());

  mount({
    publicKey: "ORGu8Sd5OK0MWx6hrz8nHVMS0II3V0JK-hVH_145WHc",
    apiUrl: "http://localhost:8007/api/v1",
    socketUrl: "http://localhost:8008",
    debug: true,
  });
})();
```