const GEO_STORAGE_KEY = "argon:network-geo";
const GEO_CACHE_TTL = 30 * 60 * 1000;
const GEO_TIMEOUT = 5000;
const GEO_ENDPOINT = "https://ipapi.co/json/";

let geoPromise = null;

function readCachedGeo() {
  try {
    const raw = sessionStorage.getItem(GEO_STORAGE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (
      !cached ||
      typeof cached !== "object" ||
      !Number.isFinite(cached.fetchedAt) ||
      Date.now() - cached.fetchedAt > GEO_CACHE_TTL
    ) {
      return null;
    }
    return cached.value;
  } catch {
    return null;
  }
}

function storeGeo(value) {
  try {
    sessionStorage.setItem(
      GEO_STORAGE_KEY,
      JSON.stringify({ fetchedAt: Date.now(), value }),
    );
  } catch {
    /* storage unavailable */
  }
}

async function fetchNetworkGeo() {
  if (typeof fetch === "undefined") return {};
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), GEO_TIMEOUT);
  try {
    const response = await fetch(GEO_ENDPOINT, { signal: controller.signal });
    if (!response.ok) return {};
    const data = await response.json();
    return {
      ...(typeof data.ip === "string" ? { ip: data.ip } : {}),
      ...(typeof data.country_name === "string" && data.country_name
        ? { detected_country: data.country_name }
        : {}),
      ...(typeof data.city === "string" && data.city
        ? { detected_city: data.city }
        : {}),
    };
  } catch {
    return {};
  } finally {
    window.clearTimeout(timer);
  }
}

export function resolveNetworkGeo() {
  const cached = readCachedGeo();
  if (cached) return Promise.resolve(cached);
  if (!geoPromise) {
    geoPromise = fetchNetworkGeo().then((value) => {
      if (value.ip) storeGeo(value);
      return value;
    });
  }
  return geoPromise;
}

function parseOperatingSystem(userAgent) {
  const windowsMatch = /Windows NT ([\d.]+)/.exec(userAgent);
  const androidMatch = /Android ([\d.]+)/.exec(userAgent);
  const iosMatch = /OS ([\d_]+) like Mac OS X/.exec(userAgent);
  const macMatch = /Mac OS X ([\d_.]+)/.exec(userAgent);

  if (windowsMatch) return { name: "Windows", version: windowsMatch[1] };
  if (androidMatch) return { name: "Android", version: androidMatch[1] };
  if (iosMatch) {
    return { name: "iOS", version: iosMatch[1].replace(/_/g, ".") };
  }
  if (macMatch) {
    return { name: "macOS", version: macMatch[1].replace(/_/g, ".") };
  }
  if (/CrOS/.test(userAgent)) return { name: "ChromeOS", version: "" };
  if (/Linux/.test(userAgent)) return { name: "Linux", version: "" };
  return { name: "", version: "" };
}

function parseBrowser(userAgent) {
  const patterns = [
    { name: "Edge", regex: /(?:Edg|EdgA|EdgiOS)\/([\d.]+)/ },
    { name: "Opera", regex: /(?:OPR|Opera)\/([\d.]+)/ },
    { name: "Samsung Internet", regex: /SamsungBrowser\/([\d.]+)/ },
    { name: "Firefox", regex: /(?:Firefox|FxiOS)\/([\d.]+)/ },
    { name: "Chrome", regex: /(?:Chrome|CriOS)\/([\d.]+)/ },
    { name: "Safari", regex: /Version\/([\d.]+).*Safari/ },
  ];

  for (const { name, regex } of patterns) {
    const match = regex.exec(userAgent);
    if (match) return { name, version: match[1] };
  }
  return { name: "", version: "" };
}

function detectDeviceType(userAgent, maxTouchPoints) {
  if (
    /iPad|Tablet|PlayBook|Silk/.test(userAgent) ||
    (/Android/.test(userAgent) && !/Mobile/.test(userAgent))
  ) {
    return "tablet";
  }
  if (/Mobi|iPhone|iPod|Windows Phone|IEMobile/.test(userAgent)) {
    return "mobile";
  }
  if (/Macintosh/.test(userAgent) && maxTouchPoints > 1) return "tablet";
  return "desktop";
}

export function collectDeviceMetadata() {
  if (typeof navigator === "undefined") return {};

  const userAgent = navigator.userAgent || "";
  const operatingSystem = parseOperatingSystem(userAgent);
  const browser = parseBrowser(userAgent);
  const metadata = {
    type: detectDeviceType(userAgent, navigator.maxTouchPoints || 0),
    os: operatingSystem.name,
    os_version: operatingSystem.version,
    browser: browser.name,
    browser_version: browser.version,
    platform: navigator.platform || "",
    touch: (navigator.maxTouchPoints || 0) > 0,
  };

  if (typeof screen !== "undefined" && screen) {
    metadata.screen = `${screen.width}x${screen.height}`;
    if (typeof window !== "undefined" && window.devicePixelRatio) {
      metadata.pixel_ratio = window.devicePixelRatio;
    }
  }
  if (navigator.hardwareConcurrency) {
    metadata.cpu_cores = navigator.hardwareConcurrency;
  }
  if (navigator.deviceMemory) metadata.memory_gb = navigator.deviceMemory;

  const connection =
    navigator.connection ||
    navigator.mozConnection ||
    navigator.webkitConnection;
  if (connection?.effectiveType) metadata.connection = connection.effectiveType;

  return metadata;
}
