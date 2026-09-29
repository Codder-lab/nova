import { CronExpressionParser } from "cron-parser";

export function parseNaturalScheduleToCron(text: string): string {
  const normalized = text.toLowerCase().trim();

  // If already a 5-part or 6-part cron expression (e.g., "0 9 * * 1" or "*/5 * * * *")
  const parts = normalized.split(/\s+/);
  if (
    (parts.length === 5 || parts.length === 6) &&
    /^[\d\*\/\,\-]+$/.test(parts[0])
  ) {
    return normalized;
  }

  // Common relative & natural language mapping
  if (/^every\s+minute$/i.test(normalized)) return "* * * * *";
  if (/^every\s+(\d+)\s+minutes?$/i.test(normalized)) {
    const match = normalized.match(/^every\s+(\d+)\s+minutes?$/i);
    return `*/${match![1]} * * * *`;
  }
  if (/^(hourly|every\s+hour)$/i.test(normalized)) return "0 * * * *";
  if (/^every\s+(\d+)\s+hours?$/i.test(normalized)) {
    const match = normalized.match(/^every\s+(\d+)\s+hours?$/i);
    return `0 */${match![1]} * * *`;
  }

  // Daily at specified time (e.g., "daily at 9am", "daily at 14:30", "every day at 8:00 pm")
  const dailyTimeMatch = normalized.match(
    /(?:daily|every\s+day)\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i,
  );
  if (dailyTimeMatch) {
    let hour = parseInt(dailyTimeMatch[1], 10);
    const minute = dailyTimeMatch[2] ? parseInt(dailyTimeMatch[2], 10) : 0;
    const ampm = dailyTimeMatch[3]?.toLowerCase();

    if (ampm === "pm" && hour < 12) hour += 12;
    if (ampm === "am" && hour === 12) hour = 0;

    return `${minute} ${hour} * * *`;
  }

  // Day of week at time (e.g. "every monday at 9 am")
  const weekdayMap: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };

  const weeklyMatch = normalized.match(
    /every\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i,
  );
  if (weeklyMatch) {
    const day = weekdayMap[weeklyMatch[1].toLowerCase()];
    let hour = parseInt(weeklyMatch[2], 10);
    const minute = weeklyMatch[3] ? parseInt(weeklyMatch[3], 10) : 0;
    const ampm = weeklyMatch[4]?.toLowerCase();

    if (ampm === "pm" && hour < 12) hour += 12;
    if (ampm === "am" && hour === 12) hour = 0;

    return `${minute} ${hour} * * ${day}`;
  }

  // Weekdays (Monday to Friday)
  const weekdaysMatch = normalized.match(
    /every\s+weekday\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i,
  );
  if (weekdaysMatch) {
    let hour = parseInt(weekdaysMatch[1], 10);
    const minute = weekdaysMatch[2] ? parseInt(weekdaysMatch[2], 10) : 0;
    const ampm = weekdaysMatch[3]?.toLowerCase();

    if (ampm === "pm" && hour < 12) hour += 12;
    if (ampm === "am" && hour === 12) hour = 0;

    return `${minute} ${hour} * * 1-5`;
  }

  if (/^(daily|every\s+day)$/i.test(normalized)) return "0 9 * * *";
  if (/^(weekly|every\s+week)$/i.test(normalized)) return "0 9 * * 1";
  if (/^(monthly|every\s+month)$/i.test(normalized)) return "0 9 1 * *";

  throw new Error(
    `Unable to parse schedule: "${text}". Please provide a 5-part cron expression (e.g. "0 9 * * 1") or phrases like "daily at 9am", "every 2 hours", "every Monday at 10:00".`,
  );
}

export function calculateNextRun(
  cronExpression: string,
  timezone = "UTC",
  currentDate = new Date(),
): Date {
  const interval = CronExpressionParser.parse(cronExpression, {
    currentDate,
    tz: timezone,
  });
  return interval.next().toDate();
}
