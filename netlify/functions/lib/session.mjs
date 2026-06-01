import {
  createHash,
  createHmac,
  timingSafeEqual,
  randomBytes
} from "node:crypto";

const COOKIE_NAME = "sst_session";

function base64Url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const remainder = padded.length % 4;
  const normalized = remainder === 0 ? padded : `${padded}${"=".repeat(4 - remainder)}`;
  return Buffer.from(normalized, "base64").toString("utf8");
}

function getSessionSecret() {
  const raw = process.env.SESSION_SECRET;
  if (!raw) {
    throw new Error("SESSION_SECRET is required");
  }
  return createHash("sha256").update(raw).digest();
}

function signPayload(payload) {
  return base64Url(
    createHmac("sha256", getSessionSecret()).update(payload).digest()
  );
}

export function createSessionToken() {
  const payload = JSON.stringify({
    nonce: base64Url(randomBytes(16)),
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000
  });
  const encodedPayload = base64Url(payload);
  const signature = signPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifySessionToken(token) {
  if (!token || !token.includes(".")) {
    return false;
  }

  const [encodedPayload, signature] = token.split(".");
  const expectedSignature = signPayload(encodedPayload);

  const received = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return false;
  }

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload));
    return Number(payload?.exp) > Date.now();
  } catch {
    return false;
  }
}

function parseCookies(event) {
  const header = event.headers?.cookie || event.headers?.Cookie;
  if (!header) {
    return {};
  }

  return Object.fromEntries(
    header
      .split(";")
      .map((chunk) => chunk.trim())
      .filter(Boolean)
      .map((pair) => {
        const index = pair.indexOf("=");
        if (index < 0) {
          return [pair, ""];
        }
        return [pair.slice(0, index), decodeURIComponent(pair.slice(index + 1))];
      })
  );
}

export function isAuthenticated(event) {
  const cookies = parseCookies(event);
  return verifySessionToken(cookies[COOKIE_NAME]);
}

export function getSessionCookie(token) {
  const secure = process.env.CONTEXT === "production" ? "; Secure" : "";
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${secure}`;
}

export function getLogoutCookie() {
  const secure = process.env.CONTEXT === "production" ? "; Secure" : "";
  return `${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`;
}

export function verifyLoginPassword(candidate) {
  const expectedPassword = process.env.APP_LOGIN_PASSWORD || "";
  const safeCandidate = String(candidate || "");

  const expected = Buffer.from(expectedPassword);
  const received = Buffer.from(safeCandidate);

  if (expected.length === 0 || expected.length !== received.length) {
    return false;
  }

  return timingSafeEqual(expected, received);
}
