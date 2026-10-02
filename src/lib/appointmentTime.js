const OFFSET_PATTERN = /(UTC|GMT)?\s*([+-])\s*(\d{1,2})(?:[.:h](\d{2}))?/i;
const CLOCK_TIME_PATTERN = /^(\d{1,2})(?:[.:h](\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?$/i;

function isValidDate(date) {
  return date instanceof Date && !Number.isNaN(date.getTime());
}

export function parseOffsetMinutes(timezone) {
  if (typeof timezone === "number" && Number.isFinite(timezone)) {
    return Math.round(timezone * 60);
  }
  const match = String(timezone ?? "").match(OFFSET_PATTERN);
  if (!match) return null;
  const sign = match[2] === "-" ? -1 : 1;
  const hours = Number(match[3]);
  const minutes = match[4] ? Number(match[4]) : 0;
  if (hours > 14 || minutes > 59) return null;
  return sign * (hours * 60 + minutes);
}

export function parseClockTime(value) {
  const match = String(value ?? "").trim().match(CLOCK_TIME_PATTERN);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = match[2] ? Number(match[2]) : 0;
  const meridiem = match[3]
    ? match[3].replace(/[^apm]/gi, "").toLowerCase()
    : "";
  if (minutes > 59) return null;
  if (meridiem === "pm" && hours < 12) hours += 12;
  if (meridiem === "am" && hours === 12) hours = 0;
  if (hours > 23) return null;
  return { hours, minutes };
}

function buildWallDate(appointment, clockValue, dayOffset) {
  const dateMatch = String(appointment?.date ?? "").match(
    /^(\d{4})-(\d{2})-(\d{2})/,
  );
  const time = parseClockTime(clockValue);
  if (!dateMatch || !time) return null;
  return {
    wallMs: Date.UTC(
      Number(dateMatch[1]),
      Number(dateMatch[2]) - 1,
      Number(dateMatch[3]) + dayOffset,
      time.hours,
      time.minutes,
    ),
  };
}

function instantFromWall(wallMs, offsetMinutes) {
  return new Date(wallMs - offsetMinutes * 60_000);
}

export function slotRange(appointment, slot) {
  const offsetMinutes = parseOffsetMinutes(appointment?.timezone);
  if (offsetMinutes === null) return null;
  const startTime = slot?.start_time ?? slot?.startTime;
  const endTime = slot?.end_time ?? slot?.endTime;
  const startWall = buildWallDate(appointment, startTime, 0);
  const endWall = buildWallDate(appointment, endTime, 0);
  if (!startWall || !endWall) return null;
  const start = instantFromWall(startWall.wallMs, offsetMinutes);
  let end = instantFromWall(endWall.wallMs, offsetMinutes);
  if (!isValidDate(start) || !isValidDate(end)) return null;
  if (end.getTime() <= start.getTime()) {
    const rolledWall = buildWallDate(appointment, endTime, 1);
    if (rolledWall) {
      const rolled = instantFromWall(rolledWall.wallMs, offsetMinutes);
      if (isValidDate(rolled) && rolled.getTime() > start.getTime()) {
        end = rolled;
      }
    }
  }
  return { start, end, offsetMinutes };
}

export function toUtcIsoString(date) {
  return date.toISOString().replace(/Z$/, "+00:00");
}

export function toOffsetIsoString(date, offsetMinutes) {
  if (!isValidDate(date) || !Number.isFinite(offsetMinutes)) return "";
  const wallTime = new Date(date.getTime() + offsetMinutes * 60_000);
  const offset = formatOffsetLabel(offsetMinutes).replace("UTC", "");
  return `${wallTime.toISOString().slice(0, 19)}${offset}`;
}

function format(date, language, options) {
  try {
    return new Intl.DateTimeFormat(language || undefined, options).format(date);
  } catch {
    return new Intl.DateTimeFormat("en", options).format(date);
  }
}

export function formatTimeRange(start, end, language) {
  const options = { hour: "numeric", minute: "2-digit" };
  return `${format(start, language, options)} – ${format(end, language, options)}`;
}

export function formatDayLabel(date, language) {
  return format(date, language, {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatShortDay(date, language) {
  return format(date, language, { month: "short", day: "numeric" });
}

export function formatDateTimeRange(start, end, language) {
  const datePart = format(start, language, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const timeOptions = { hour: "numeric", minute: "2-digit" };
  const timePart = end
    ? `${format(start, language, timeOptions)} – ${format(end, language, timeOptions)}`
    : format(start, language, timeOptions);
  return `${datePart}, ${timePart}`;
}

export function formatBusinessTimeRange(start, end, offsetMinutes, language) {
  const shiftedStart = new Date(start.getTime() + offsetMinutes * 60_000);
  const shiftedEnd = new Date(end.getTime() + offsetMinutes * 60_000);
  const options = {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  };
  return `${format(shiftedStart, language, options)} – ${format(shiftedEnd, language, options)}`;
}

export function formatOffsetLabel(offsetMinutes) {
  const sign = offsetMinutes < 0 ? "-" : "+";
  const absolute = Math.abs(offsetMinutes);
  const hours = String(Math.floor(absolute / 60)).padStart(2, "0");
  const minutes = String(absolute % 60).padStart(2, "0");
  return `UTC${sign}${hours}:${minutes}`;
}

export function getUserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    return "";
  }
}

export function getUserTimeZoneLabel(referenceDate = new Date()) {
  const timeZone = getUserTimeZone();
  const offsetMinutes = -referenceDate.getTimezoneOffset();
  const offsetLabel = formatOffsetLabel(offsetMinutes);
  return timeZone ? `${timeZone} (${offsetLabel})` : offsetLabel;
}

export function localDayKey(date) {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    return "";
  }
}
