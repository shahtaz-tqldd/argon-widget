import { ChatWidget } from "./components/chat-widget";

const demoConfig = {
  publicKey: "ORGu8Sd5OK0MWx6hrz8nHVMS0II3V0JK-hVH_145WHc",
  name: "Argon Assistant",
  welcomeMessage: "Hi! How can we help you today?",
  primaryColor: "#6d5dfc",
  position: "right",
};

export default function App() {
  return (
    <main className="demo-page">
      <div className="demo-copy">
        <span className="demo-eyebrow">Argon widget</span>
        <h1>An embeddable support chat for every website.</h1>
        <p>
          This page is the local widget playground. Use the launcher below to
          test the interface while the public visitor API is connected.
        </p>
      </div>
      <ChatWidget config={demoConfig} />
    </main>
  );
}
