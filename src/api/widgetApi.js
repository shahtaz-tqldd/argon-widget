import { request } from "./httpClient";

function chatbotEndpoint(config, suffix = "") {
  const baseUrl = config.apiUrl.replace(/\/$/, "");
  const publicKey = encodeURIComponent(config.publicKey);
  return `${baseUrl}/chatbots/${publicKey}/${suffix}`;
}

export function createWidgetApi(config) {
  const conversationUrl = chatbotEndpoint(config, "conversations/");

  return {
    async getConfiguration(options = {}) {
      return request(chatbotEndpoint(config), options);
    },

    async startConversation(conversationToken, options = {}) {
      return request(conversationUrl, {
        method: "POST",
        ...options,
        body: conversationToken ? { conversation_token: conversationToken } : {},
      });
    },

    async sendMessage({ content, sessionId, conversationToken, clientMessageId }) {
      return request(chatbotEndpoint(config, `conversations/${sessionId}/messages/`), {
        method: "POST",
        headers: { Authorization: `Bearer ${conversationToken}` },
        body: {
          content,
          client_message_id: clientMessageId,
          metadata: { page_url: window.location.href, page_title: document.title },
        },
      });
    },
  };
}
