export const PUBLIC_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "icloud.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
]);

export function normalize(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function normalizeSearchText(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9@.]+/g, " ")
    .trim();
}

export function normalizeEmail(value = "") {
  return String(value).trim().toLowerCase();
}

export function normalizeKeyword(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}

export function getEmailDomain(value = "") {
  const domain = normalizeEmail(value).split("@")[1] ?? "";
  return PUBLIC_EMAIL_DOMAINS.has(domain) ? "" : domain;
}

export function getTranscriptEmails(transcript) {
  return [
    ...(transcript.participants ?? []),
    ...(transcript.attendees ?? []).map((attendee) => attendee.email),
  ]
    .map((email) => normalizeEmail(email ?? ""))
    .filter(Boolean);
}

export function getTranscriptEmailDomains(transcript) {
  return getTranscriptEmails(transcript).map(getEmailDomain).filter(Boolean);
}

export function getAccountEmailDomains(account) {
  return [
    account.primaryContact?.email,
    ...(account.stakeholders ?? []).map((stakeholder) => stakeholder.email),
  ]
    .map(getEmailDomain)
    .filter(Boolean);
}

export function getTranscriptDisplayDate(transcript) {
  if (!transcript.date) return "Recent";
  const numericDate = new Date(Number(transcript.date));
  if (!Number.isNaN(numericDate.getTime())) return numericDate.toLocaleDateString("en-US");
  const parsedDate = new Date(transcript.date);
  if (!Number.isNaN(parsedDate.getTime())) return parsedDate.toLocaleDateString("en-US");
  return String(transcript.date);
}

export function toFirefliesId(value = "", fallback = "item") {
  return normalize(value).replace(/\s+/g, "-").slice(0, 80) || fallback;
}
