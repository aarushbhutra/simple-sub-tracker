import { createSessionToken, getLogoutCookie, getSessionCookie, isAuthenticated, verifyLoginPassword } from "./lib/session.mjs";
import { errorResponse, getQueryValue, jsonResponse, parseJsonBody } from "./lib/http.mjs";

export async function handler(event) {
  try {
    if (event.httpMethod === "GET") {
      const action = getQueryValue(event, "action");
      if (action === "session") {
        return jsonResponse(200, { authenticated: isAuthenticated(event) });
      }
      return errorResponse(400, "invalid action");
    }

    if (event.httpMethod === "POST") {
      const body = await parseJsonBody(event);
      if (!verifyLoginPassword(body.password)) {
        return errorResponse(401, "invalid password");
      }

      const token = createSessionToken();
      return jsonResponse(
        200,
        { ok: true },
        { "Set-Cookie": getSessionCookie(token) }
      );
    }

    if (event.httpMethod === "DELETE") {
      return jsonResponse(
        200,
        { ok: true },
        { "Set-Cookie": getLogoutCookie() }
      );
    }

    return errorResponse(405, "method not allowed");
  } catch (error) {
    return errorResponse(500, error.message || "auth handler failed");
  }
}
