const GEO_STORAGE_KEY = "argon:network-geo";
const GEO_CACHE_TTL = 30 * 60 * 1000;
const GEO_TIMEOUT = 5000;
const GEO_ENDPOINT =
  "https://ipwho.is/?fields=success,ip,country,city";

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
    if (data.success === false) return {};
    return {
      ...(typeof data.ip === "string" ? { ip: data.ip } : {}),
      ...(typeof data.country === "string" && data.country
        ? { detected_country: data.country }
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
