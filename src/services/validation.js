const SCRIPT_LIKE_RE = /<\s*\/?\s*script\b|\son[a-z]+\s*=/i;
const MEANINGFUL_TEXT_RE = /[\p{L}\p{N}]/u;
const REPEATED_CHAR_RE = /^(.)\1{7,}$/u;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const URL_PROTOCOL_RE = /^[a-z][a-z0-9+.-]*:\/\//i;

function hasUnsupportedControlCharacter(text) {
  return Array.from(text).some((char) => {
    const code = char.charCodeAt(0);
    return code === 127 || (code < 32 && code !== 9 && code !== 10 && code !== 13);
  });
}

export function normalizeText(value, options = {}) {
  const {
    field = "Field",
    required = false,
    maxLength = 255,
    minLength = 1,
    meaningful = false,
    multiline = false,
    emptyAsNull = true,
  } = options;
  const text = String(value ?? "").trim();

  if (!text) {
    if (required) throw new Error(`${field} is required.`);
    return emptyAsNull ? null : "";
  }
  if (text.length < minLength) throw new Error(`${field} must be at least ${minLength} characters.`);
  if (text.length > maxLength) throw new Error(`${field} must be ${maxLength} characters or fewer.`);
  if (hasUnsupportedControlCharacter(text)) throw new Error(`${field} contains unsupported characters.`);
  if (!multiline && /[\r\n]/.test(text)) throw new Error(`${field} must be a single line.`);
  if (SCRIPT_LIKE_RE.test(text)) throw new Error(`${field} contains unsafe text.`);
  if (meaningful && (!MEANINGFUL_TEXT_RE.test(text) || REPEATED_CHAR_RE.test(text))) {
    throw new Error(`${field} must contain meaningful text.`);
  }

  return text;
}

export function normalizeId(value, field = "ID") {
  const id = normalizeText(value, { field, required: true, maxLength: 120, meaningful: true });
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(id)) {
    throw new Error(`${field} can only contain letters, numbers, dots, underscores, dashes, and colons.`);
  }
  return id;
}

export function normalizeEnum(value, allowedValues, field = "Field") {
  const text = normalizeText(value, { field, required: true, maxLength: 80, meaningful: true });
  if (!allowedValues.has(text)) throw new Error(`Select a valid ${field.toLowerCase()}.`);
  return text;
}

export function normalizeDate(value, field = "Date", options = {}) {
  const { required = false } = options;
  const text = normalizeText(value, { field, required, maxLength: 20 });
  if (!text) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error(`${field} must be a valid date.`);
  const date = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) {
    throw new Error(`${field} must be a valid date.`);
  }
  return text;
}

export function normalizeNumber(value, options = {}) {
  const {
    field = "Number",
    required = false,
    min = 0,
    max = Number.MAX_SAFE_INTEGER,
    integer = false,
    defaultValue = null,
  } = options;
  if (value === "" || value === null || value === undefined) {
    if (required) throw new Error(`${field} is required.`);
    return defaultValue;
  }
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${field} must be a valid number.`);
  if (integer && !Number.isInteger(number)) throw new Error(`${field} must be a whole number.`);
  if (number < min || number > max) {
    throw new Error(`${field} must be between ${min} and ${max}.`);
  }
  return number;
}

export function normalizeMoney(value, field = "Amount", options = {}) {
  return normalizeNumber(value, {
    field,
    required: options.required ?? false,
    min: 0,
    max: options.max ?? 1_000_000_000_000,
    defaultValue: options.defaultValue ?? null,
  });
}

export function normalizeEmail(value, field = "Email", options = {}) {
  const text = normalizeText(value, { field, required: options.required ?? false, maxLength: 254 });
  if (!text) return null;
  const email = text.toLowerCase();
  if (!EMAIL_RE.test(email)) throw new Error(`Enter a valid ${field.toLowerCase()}.`);
  return email;
}

export function normalizePhone(value, field = "Phone", options = {}) {
  const text = normalizeText(value, { field, required: options.required ?? false, maxLength: 40 });
  if (!text) return null;
  if (!/^[+()0-9.\-\s]+$/.test(text)) throw new Error(`Enter a valid ${field.toLowerCase()}.`);
  const digits = text.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 20) throw new Error(`Enter a valid ${field.toLowerCase()}.`);
  return text;
}

export function normalizeUrl(value, field = "URL", options = {}) {
  const text = normalizeText(value, { field, required: options.required ?? false, maxLength: 500 });
  if (!text) return null;
  const candidate = URL_PROTOCOL_RE.test(text) ? text : `https://${text}`;
  let url;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error(`Enter a valid ${field.toLowerCase()}.`);
  }
  const hostAllowed =
    url.hostname.includes(".") ||
    (options.allowLocalhost && ["localhost", "127.0.0.1", "::1"].includes(url.hostname));
  if (!["http:", "https:"].includes(url.protocol) || !hostAllowed) {
    throw new Error(`Enter a valid ${field.toLowerCase()}.`);
  }
  return url.toString();
}

export function normalizeStringList(values, options = {}) {
  const { field = "Item", maxItems = 25, maxLength = 180, meaningful = true } = options;
  if (!Array.isArray(values)) return [];
  return values
    .slice(0, maxItems)
    .map((value) =>
      normalizeText(value, {
        field,
        maxLength,
        meaningful,
        emptyAsNull: false,
      }),
    )
    .filter(Boolean);
}
