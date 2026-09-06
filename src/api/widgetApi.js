import { request } from "./httpClient";

const IP_LOOKUP_URL = "https://ipwho.is/";

function chatbotEndpoint(config, suffix = "") {
  const baseUrl = config.apiUrl.replace(/\/$/, "");
  const publicKey = encodeURIComponent(config.publicKey);
  return `${baseUrl}/chatbots/${publicKey}/${suffix}`;
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

async function detectUserMetadata() {
  const response = await fetch(IP_LOOKUP_URL, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error("Visitor location lookup failed.");

  const result = await response.json();
  if (result?.success === false) return {};

  const addressParts = [result?.city, result?.region]
    .map(cleanString)
    .filter((value, index, values) => (
      value && values.findIndex((item) => item.toLowerCase() === value.toLowerCase()) === index
    ));
  const values = {
    ip: cleanString(result?.ip),
    detected_address: addressParts.join(", "),
    detected_country: cleanString(result?.country),
  };

  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value),
  );
}

export function createWidgetApi(config) {
  const conversationUrl = chatbotEndpoint(config, "conversations/");
  let detectedUserMetadata = null;
  let userMetadataPromise = null;

  function loadUserMetadata() {
    if (!userMetadataPromise) {
      userMetadataPromise = detectUserMetadata()
        .catch(() => ({}))
        .then((metadata) => {
          detectedUserMetadata = metadata;
          return metadata;
        });
    }
    return userMetadataPromise;
  }

  return {
    async getConfiguration(options = {}) {
      void loadUserMetadata();
      return request(chatbotEndpoint(config), options);
    },

    async getVisitor(visitorId, options = {}) {
      return request(
        chatbotEndpoint(config, `visitors/${encodeURIComponent(visitorId)}/`),
        options,
      );
    },

    async getVisitorSessions(visitorId, options = {}) {
      return request(
        chatbotEndpoint(
          config,
          `visitors/${encodeURIComponent(visitorId)}/sessions/`,
        ),
        options,
      );
    },

    async startConversation(
      { conversationToken = "", leadData, leadId } = {},
      options = {},
    ) {
      const isNewConversation = !conversationToken;
      if (isNewConversation) void loadUserMetadata();
      const includedUserMetadata = isNewConversation
        ? detectedUserMetadata
        : null;
      const bootstrap = await request(conversationUrl, {
        method: "POST",
        ...options,
        body: conversationToken
          ? {
            conversation_token: conversationToken,
            ...(leadData ? { lead_data: leadData } : {}),
            ...(leadId ? { lead_id: leadId } : {}),
          }
        : {
            ...(leadData ? { lead_data: leadData } : {}),
            ...(leadId ? { lead_id: leadId } : {}),
              ...(includedUserMetadata && Object.keys(includedUserMetadata).length
                ? { user_metadata: includedUserMetadata }
                : {}),
              metadata: {
                page_url: window.location.href,
                page_title: document.title,
              },
            },
      });

      if (
        isNewConversation &&
        !bootstrap.resumed &&
        !includedUserMetadata &&
        bootstrap.conversation_token
      ) {
        void loadUserMetadata().then((userMetadata) => {
          if (!Object.keys(userMetadata).length) return undefined;
          return request(conversationUrl, {
            method: "POST",
            body: {
              conversation_token: bootstrap.conversation_token,
              user_metadata: userMetadata,
            },
          });
        }).catch(() => {});
      }

      return bootstrap;
    },

    async sendMessage({
      content,
      sessionId,
      conversationToken,
      clientMessageId,
    }) {
      return request(
        chatbotEndpoint(config, `conversations/${sessionId}/messages/`),
        {
          method: "POST",
          headers: { Authorization: `Bearer ${conversationToken}` },
          body: {
            content,
            client_message_id: clientMessageId,
          },
        },
      );
    },
  };
}
