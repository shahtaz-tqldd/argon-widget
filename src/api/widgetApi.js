import { request } from "./httpClient";

function chatbotEndpoint(config, suffix = "") {
  const baseUrl = config.apiUrl.replace(/\/$/, "");
  const publicKey = encodeURIComponent(config.publicKey);
  return `${baseUrl}/chatbots/${publicKey}/${suffix}`;
}

function getWidgetContext() {
  if (typeof window === "undefined") return {};
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return {
    userMetadata: {
      ...(navigator.language ? { locale: navigator.language } : {}),
      ...(timezone ? { timezone } : {}),
    },
    metadata: {
      page_url: window.location.href,
      ...(typeof document !== "undefined" && document.title
        ? { page_title: document.title }
        : {}),
    },
  };
}

export function createWidgetApi(config, visitorId) {
  function visitorEndpoint(suffix) {
    const query = new URLSearchParams({ visitor_id: visitorId });
    return `${chatbotEndpoint(config, suffix)}?${query}`;
  }

  return {
    async getConfiguration(options = {}) {
      return request(chatbotEndpoint(config, "config/"), options);
    },

    async getVisitorDetails(options = {}) {
      return request(visitorEndpoint("visitor/details/"), options);
    },

    async getVisitorSessions(options = {}) {
      return request(visitorEndpoint("sessions/list/"), options);
    },

    async getConversationMessages(
      {
        sessionId,
        conversationToken,
        page = 1,
        pageSize = 20,
      },
      options = {},
    ) {
      const query = new URLSearchParams({
        visitor_id: visitorId,
        session_id: sessionId,
        conversation_token: conversationToken,
        page: String(page),
        page_size: String(pageSize),
      });
      return request(
        `${chatbotEndpoint(config, "messages/list/")}?${query}`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${conversationToken}` },
          ...options,
        },
      );
    },

    async startConversation(
      { conversationToken = "", leadData } = {},
      options = {},
    ) {
      const { userMetadata = {}, metadata = {} } = getWidgetContext();
      return request(visitorEndpoint("visitor/create/"), {
        method: "POST",
        ...options,
        body: {
          ...(conversationToken ? { conversation_token: conversationToken } : {}),
          ...(leadData ? { lead_data: leadData } : {}),
          ...(Object.keys(userMetadata).length
            ? { user_metadata: userMetadata }
            : {}),
          ...(Object.keys(metadata).length ? { metadata } : {}),
        },
      });
    },

    async sendMessage({
      content,
      sessionId,
      conversationToken,
      clientMessageId,
    }) {
      const query = new URLSearchParams({
        visitor_id: visitorId,
        session_id: sessionId,
      });
      const { metadata = {} } = getWidgetContext();
      return request(`${chatbotEndpoint(config, "messages/create/")}?${query}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${conversationToken}` },
        body: {
          content,
          client_message_id: clientMessageId,
          ...(Object.keys(metadata).length ? { metadata } : {}),
        },
      });
    },
  };
}
