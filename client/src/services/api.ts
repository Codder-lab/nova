const API_BASE = "/api";

export interface RunAgentPayload {
  goal: string;
  conversationId?: string;
  maxSteps?: number;
  timeoutMs?: number;
  provider?: string;
  model?: string;
}

async function request(url: string, init?: RequestInit) {
  const res = await fetch(url, {
    credentials: "include",
    ...init,
    headers: {
      ...(init?.headers || {}),
    },
  });
  return res.json();
}

export const api = {
  // Chat Sessions & Conversations
  listSessions: async (search?: string) => {
    const query = search ? `?search=${encodeURIComponent(search)}` : "";
    return request(`${API_BASE}/conversations${query}`);
  },

  getSession: async (id: string) => {
    return request(`${API_BASE}/conversations/${id}`);
  },

  createSession: async (title?: string) => {
    return request(`${API_BASE}/conversations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
  },

  updateSession: async (
    id: string,
    data: { title?: string; metadata?: Record<string, unknown> },
  ) => {
    return request(`${API_BASE}/conversations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  },

  deleteSession: async (id: string) => {
    return request(`${API_BASE}/conversations/${id}`, {
      method: "DELETE",
    });
  },

  clearSession: async (id: string) => {
    return request(`${API_BASE}/conversations/${id}/clear`, {
      method: "POST",
    });
  },

  // Agent & Execution
  runAgent: async (payload: RunAgentPayload) => {
    return request(`${API_BASE}/agent/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },

  listTools: async () => {
    const res = await fetch(`${API_BASE}/agent/tools`);
    return res.json();
  },

  listRuns: async () => {
    const res = await fetch(`${API_BASE}/agent/runs?limit=30`);
    return res.json();
  },

  getRunById: async (runId: string) => {
    const res = await fetch(`${API_BASE}/agent/runs/${runId}`);
    return res.json();
  },

  getPendingApproval: async (runId: string) => {
    const res = await fetch(`${API_BASE}/agent/runs/${runId}/pending-approval`);
    return res.json();
  },

  approveAction: async (runId: string) => {
    const res = await fetch(`${API_BASE}/agent/runs/${runId}/approve`, {
      method: "POST",
    });
    return res.json();
  },

  rejectAction: async (runId: string) => {
    const res = await fetch(`${API_BASE}/agent/runs/${runId}/reject`, {
      method: "POST",
    });
    return res.json();
  },

  // Multi-Model Management
  listModels: async () => {
    return request(`${API_BASE}/models`);
  },

  refreshModels: async () => {
    return request(`${API_BASE}/models/refresh`, {
      method: "POST",
    });
  },

  setActiveModel: async (provider: string, model: string) => {
    return request(`${API_BASE}/models/active`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, model }),
    });
  },

  updateModelConfig: async (data: {
    apiKeys?: Record<string, string>;
    customBaseUrls?: Record<string, string>;
    temperature?: number;
    maxTokens?: number;
  }) => {
    return request(`${API_BASE}/models/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  },

  testModelConnection: async (data: {
    provider: string;
    model?: string;
    apiKey?: string;
    baseUrl?: string;
  }) => {
    return request(`${API_BASE}/models/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  },

  getModelMetrics: async () => {
    return request(`${API_BASE}/models/metrics`);
  },

  // Tasks
  listTasks: async (status = "all") => {
    const res = await fetch(`${API_BASE}/tasks?status=${status}&limit=50`);
    return res.json();
  },

  createTask: async (data: {
    title: string;
    description?: string;
    priority?: string;
    dueDate?: string;
    tags?: string[];
  }) => {
    const res = await fetch(`${API_BASE}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  updateTask: async (id: string, data: Record<string, unknown>) => {
    const res = await fetch(`${API_BASE}/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  deleteTask: async (id: string) => {
    const res = await fetch(`${API_BASE}/tasks/${id}`, { method: "DELETE" });
    return res.json();
  },

  // Reminders
  listReminders: async () => {
    const res = await fetch(`${API_BASE}/reminders?limit=50`);
    return res.json();
  },

  createReminder: async (data: {
    title: string;
    remindAt: string;
    description?: string;
  }) => {
    const res = await fetch(`${API_BASE}/reminders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  cancelReminder: async (id: string) => {
    const res = await fetch(`${API_BASE}/reminders/${id}/cancel`, {
      method: "PATCH",
    });
    return res.json();
  },

  deleteReminder: async (id: string) => {
    const res = await fetch(`${API_BASE}/reminders/${id}`, {
      method: "DELETE",
    });
    return res.json();
  },

  // Memories
  listMemories: async (category?: string) => {
    const url =
      category && category !== "all"
        ? `${API_BASE}/memories?category=${category}`
        : `${API_BASE}/memories`;
    const res = await fetch(url);
    return res.json();
  },

  searchMemories: async (query: string) => {
    const res = await fetch(
      `${API_BASE}/memories/search?q=${encodeURIComponent(query)}`,
    );
    return res.json();
  },

  createMemory: async (data: {
    content: string;
    category?: string;
    tags?: string[];
    importance?: number;
  }) => {
    const res = await fetch(`${API_BASE}/memories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  deleteMemory: async (id: string) => {
    const res = await fetch(`${API_BASE}/memories/${id}`, { method: "DELETE" });
    return res.json();
  },

  // Schedules
  listSchedules: async () => {
    const res = await fetch(`${API_BASE}/schedules`);
    return res.json();
  },

  createSchedule: async (data: {
    prompt: string;
    schedule: string;
    timezone?: string;
  }) => {
    const res = await fetch(`${API_BASE}/schedules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  toggleSchedule: async (id: string, enabled: boolean) => {
    const res = await fetch(`${API_BASE}/schedules/${id}/toggle`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    return res.json();
  },

  deleteSchedule: async (id: string) => {
    const res = await fetch(`${API_BASE}/schedules/${id}`, {
      method: "DELETE",
    });
    return res.json();
  },

  // System Health
  getHealth: async () => {
    try {
      const res = await fetch(`${API_BASE}/health`);
      if (res.ok) return await res.json();
      const fallback = await fetch("/health");
      return await fallback.json();
    } catch {
      return { status: "ok", llmProvider: "Ollama", model: "qwen2.5:7b" };
    }
  },
};
