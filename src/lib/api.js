async function parseResponse(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error || "request failed";
    throw new Error(message);
  }
  return payload;
}

export async function checkSession() {
  const response = await fetch("/api/auth?action=session", {
    credentials: "include"
  });
  return parseResponse(response);
}

export async function login(password) {
  const response = await fetch("/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ password })
  });
  return parseResponse(response);
}

export async function logout() {
  const response = await fetch("/api/auth", {
    method: "DELETE",
    credentials: "include"
  });
  return parseResponse(response);
}

export async function listSubscriptions() {
  const response = await fetch("/api/subscriptions", {
    credentials: "include"
  });
  return parseResponse(response);
}

export async function createSubscription(input) {
  const response = await fetch("/api/subscriptions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input)
  });
  return parseResponse(response);
}

export async function updateSubscription(id, input) {
  const response = await fetch(`/api/subscriptions?id=${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input)
  });
  return parseResponse(response);
}

export async function deleteSubscription(id) {
  const response = await fetch(`/api/subscriptions?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include"
  });
  return parseResponse(response);
}
