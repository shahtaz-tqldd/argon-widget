const env = import.meta.env;

export const defaultWidgetConfig = Object.freeze({
  apiUrl: env.VITE_APP_BASE_URL || "http://localhost:8007/api/v1",
  socketUrl: env.VITE_APP_SOCKET_URL || "http://localhost:8008",
  publicKey: "",
  name: "Support",
  headerDescription: "Typically replies instantly",
  welcomeMessage: "Hi! How can we help you today?",
  placeholder: "Write a message…",
  primaryColor: "#6d5dfc",
  secondaryColor: "#fafafa",
  position: "right",
  logo: "",
  launcherText: "",
  showBranding: true,
  theme: "light",
  language: "en",
  leadConfig: null,
  debug: false,
});

export function resolveWidgetConfig(config = {}) {
  const definedConfig = Object.fromEntries(
    Object.entries(config).filter(([, value]) => value !== undefined),
  );
  const resolved = { ...defaultWidgetConfig, ...definedConfig };
  resolved.position = resolved.position === "left" ? "left" : "right";
  return resolved;
}

export function configFromElement(element) {
  return resolveWidgetConfig({
    apiUrl: element?.dataset.apiUrl,
    socketUrl: element?.dataset.socketUrl,
    publicKey: element?.dataset.chatbot,
    name: element?.dataset.name,
    welcomeMessage: element?.dataset.welcomeMessage,
    placeholder: element?.dataset.placeholder,
    primaryColor: element?.dataset.primaryColor,
    position: element?.dataset.position,
    debug: element?.dataset.debug === "true",
  });
}

export function mapPublicConfiguration(data) {
  const settings = data?.widget_settings ?? {};
  const leadConfig = data?.lead_config ?? {};
  return {
    name: settings.header_title || data?.chatbot_name,
    headerDescription: settings.header_description,
    welcomeMessage: data?.welcome_message,
    primaryColor: settings.primary_color,
    secondaryColor: settings.secondary_color,
    position: settings.launcher_position === "bottom_left" ? "left" : "right",
    logo: data?.logo,
    launcherText: settings.launcher_text,
    showBranding: settings.show_branding,
    theme: settings.theme,
    language: data?.language,
    businessName: data?.business_name,
    description: data?.description,
    otherSettings: settings.other_settings,
    leadConfig: {
      isEnabled: leadConfig.is_enabled === true,
      autoCollect: leadConfig.auto_collect === true,
      introMessage: leadConfig.intro_message || "",
      requireConsent: leadConfig.require_consent === true,
      consentMessage: leadConfig.consent_message || "",
      fields: Array.isArray(leadConfig.collectable_fields)
        ? leadConfig.collectable_fields
        : [],
    },
  };
}
