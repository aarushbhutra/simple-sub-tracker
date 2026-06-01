export function jsonResponse(statusCode, payload, headers = {}) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers
    },
    body: JSON.stringify(payload)
  };
}

export function errorResponse(statusCode, message) {
  return jsonResponse(statusCode, { error: message });
}

export async function parseJsonBody(event, maxBytes = 64_000) {
  const bodyText = event.body || "";
  if (bodyText.length > maxBytes) {
    throw new Error("payload too large");
  }

  if (!bodyText) {
    return {};
  }

  try {
    return JSON.parse(bodyText);
  } catch {
    throw new Error("invalid json body");
  }
}

export function getQueryValue(event, key) {
  return event.queryStringParameters?.[key] ?? null;
}
