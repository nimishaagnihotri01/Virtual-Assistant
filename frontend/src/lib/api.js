const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    ...options,
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error ?? "The request could not be completed.");
  }

  return payload;
}

export function fetchHealth() {
  return request("/api/health");
}

export function sendAssistantMessage(body) {
  return request("/api/assistant/chat", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function signInUser(body) {
  return request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function signUpUser(body) {
  return request("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
