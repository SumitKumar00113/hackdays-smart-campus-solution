const pad = (value) => String(value).padStart(2, "0");

const toISODate = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const isValidDate = (year, month, day) => {
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
};

const normalizeDate = (year, month, day, rawText) => {
  if (!isValidDate(year, month, day)) return null;

  return {
    date: toISODate(new Date(year, month - 1, day)),
    rawDate: rawText,
  };
};

const MONTHS = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

const WEEKDAYS = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const INTENT_PATTERNS = {
  attendance: [
    /\battendance\b/i,
    /\battend\b/i,
    /\bpresent\b/i,
    /\babsent\b/i,
    /\blate\b/i,
  ],
  booking: [
    /\b(empty|free|available|vacant)\s+(classroom|room)s?\b/i,
    /\b(classroom|room)s?\s+(empty|free|available|vacant)\b/i,
    /\bbook(ing)?\b/i,
    /\bclassroom\b/i,
    /\btimeslot\b/i,
  ],
  notice: [
    /\bnotices?\b/i,
    /\bannouncements?\b/i,
    /\bcirculars?\b/i,
    /\bupdates?\b/i,
  ],
};

const scoreIntent = (message, patterns) =>
  patterns.reduce((score, pattern) => score + (pattern.test(message) ? 1 : 0), 0);

const detectIntent = (message) => {
  const scores = Object.entries(INTENT_PATTERNS).map(([intent, patterns]) => ({
    intent,
    score: scoreIntent(message, patterns),
  }));

  const best = scores.sort((a, b) => b.score - a.score)[0];
  return best?.score > 0 ? best.intent : null;
};

const normalizeTime = (hour, minute, meridiem) => {
  let normalizedHour = Number(hour);
  const normalizedMinute = Number(minute || 0);

  if (meridiem) {
    const suffix = meridiem.toLowerCase().replace(/\./g, "");
    if (suffix === "pm" && normalizedHour !== 12) normalizedHour += 12;
    if (suffix === "am" && normalizedHour === 12) normalizedHour = 0;
  }

  return `${pad(normalizedHour)}:${pad(normalizedMinute)}`;
};

const extractTime = (message) => {
  const lowered = message.toLowerCase();
  const namedTime = lowered.match(/\b(noon|midnight)\b/i);

  if (namedTime) {
    return {
      time: namedTime[1].toLowerCase() === "noon" ? "12:00" : "00:00",
      rawTime: namedTime[0],
    };
  }

  const twelveHour = message.match(
    /\b(?:at|around|by|from|for)?\s*(1[0-2]|0?[1-9])(?:[:.]([0-5]\d))?\s*(a\.?m\.?|p\.?m\.?)\b/i,
  );

  if (twelveHour) {
    return {
      time: normalizeTime(twelveHour[1], twelveHour[2], twelveHour[3]),
      rawTime: twelveHour[0].trim(),
    };
  }

  const twentyFourHour = message.match(
    /\b(?:at|around|by|from|for)?\s*([01]?\d|2[0-3]):([0-5]\d)\b/i,
  );

  if (twentyFourHour) {
    return {
      time: normalizeTime(twentyFourHour[1], twentyFourHour[2]),
      rawTime: twentyFourHour[0].trim(),
    };
  }

  return {};
};

const extractDate = (message, now = new Date()) => {
  const lowered = message.toLowerCase();

  if (/\btoday\b/.test(lowered)) {
    return { date: toISODate(now), rawDate: "today" };
  }

  if (/\btomorrow\b/.test(lowered)) {
    return { date: toISODate(addDays(now, 1)), rawDate: "tomorrow" };
  }

  if (/\byesterday\b/.test(lowered)) {
    return { date: toISODate(addDays(now, -1)), rawDate: "yesterday" };
  }

  const isoDate = lowered.match(
    /\b((?:19|20)\d{2})-(0?[1-9]|1[0-2])-(0?[1-9]|[12]\d|3[01])\b/,
  );

  if (isoDate) {
    return (
      normalizeDate(
        Number(isoDate[1]),
        Number(isoDate[2]),
        Number(isoDate[3]),
        isoDate[0],
      ) || {}
    );
  }

  const slashDate = lowered.match(
    /\b(0?[1-9]|[12]\d|3[01])[/-](0?[1-9]|1[0-2])[/-]((?:19|20)?\d{2})\b/,
  );

  if (slashDate) {
    const year =
      slashDate[3].length === 2 ? Number(`20${slashDate[3]}`) : Number(slashDate[3]);
    return (
      normalizeDate(year, Number(slashDate[2]), Number(slashDate[1]), slashDate[0]) ||
      {}
    );
  }

  const monthNames = Object.keys(MONTHS).join("|");
  const monthDate = lowered.match(
    new RegExp(`\\b(${monthNames})\\s+(0?[1-9]|[12]\\d|3[01])(?:,?\\s+((?:19|20)\\d{2}))?\\b`, "i"),
  );

  if (monthDate) {
    return (
      normalizeDate(
        monthDate[3] ? Number(monthDate[3]) : now.getFullYear(),
        MONTHS[monthDate[1].toLowerCase()],
        Number(monthDate[2]),
        monthDate[0],
      ) || {}
    );
  }

  const weekday = lowered.match(
    /\b(next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i,
  );

  if (weekday) {
    const targetDay = WEEKDAYS[weekday[2].toLowerCase()];
    const currentDay = now.getDay();
    let daysAhead = (targetDay - currentDay + 7) % 7;
    if (weekday[1] || daysAhead === 0) daysAhead += 7;

    return {
      date: toISODate(addDays(now, daysAhead)),
      rawDate: weekday[0],
    };
  }

  return {};
};

const parseIntent = (message, options = {}) => {
  const normalizedMessage = String(message || "").trim();
  const now = options.now instanceof Date ? options.now : new Date();
  const intent = detectIntent(normalizedMessage);

  return {
    intent,
    type: intent || "chat",
    params: {
      ...extractDate(normalizedMessage, now),
      ...extractTime(normalizedMessage),
    },
  };
};

module.exports = {
  parseIntent,
  extractDate,
  extractTime,
};
