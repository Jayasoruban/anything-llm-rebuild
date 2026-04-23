const TOKEN_KEY = "anythingllm.token";

export const Token = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

const request = async (method, path, body) => {
  const headers = { "Content-Type": "application/json" };
  const token = Token.get();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  if (!res.ok) {
    const err = new Error(data?.error ?? `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
};

export const api = {
  get: (path) => request("GET", path),
  post: (path, body) => request("POST", path, body),
  del: (path) => request("DELETE", path),
};

export const authApi = {
  needsSetup: () => api.get("/setup/needs-setup"),
  createFirstUser: (username, password) =>
    api.post("/setup/create-first-user", { username, password }),
  login: (username, password) =>
    api.post("/auth/login", { username, password }),
  me: () => api.get("/auth/me"),
};

export const settingsApi = {
  getLLM: () => api.get("/system-settings/llm-provider"),
  saveLLM: ({ provider, apiKey, model }) =>
    api.post("/system-settings/llm-provider", { provider, apiKey, model }),
  testLLM: ({ provider, apiKey, model }) =>
    api.post("/system-settings/llm-provider/test", { provider, apiKey, model }),
};

export const chatApi = {
  getHistory: (slug) => api.get(`/workspace/${slug}/chats`),
  send: (slug, message) => api.post(`/workspace/${slug}/chat`, { message }),
  clear: (slug) => api.del(`/workspace/${slug}/chats`),

  // Streaming POST. Emits parsed SSE events to `onEvent`:
  //   { type: "chunk", text }
  //   { type: "done", id, response, createdAt }
  //   { type: "error", error }
  // Returns an AbortController so the caller can cancel (e.g. on logout).
  stream: (slug, message, onEvent) => {
    const ctrl = new AbortController();

    const run = async () => {
      const token = Token.get();
      const res = await fetch(`/api/workspace/${slug}/stream-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message }),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          try {
            onEvent(JSON.parse(line.slice(5).trim()));
          } catch {
            // ignore malformed frame
          }
        }
      }
    };

    const promise = run().catch((err) => {
      if (err.name !== "AbortError") onEvent({ type: "error", error: err.message });
    });

    return { abort: () => ctrl.abort(), promise };
  },
};
