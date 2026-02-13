import { beforeEach, describe, expect, it, vi } from "vitest";
import { type AuthContext, WebMCPRegistry } from "../src/lib/webmcp";
import { registerConversationTools } from "../src/lib/webmcp-conversation";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function mockJsonResponse(data: unknown, ok = true, status = 200) {
	return {
		ok,
		status,
		json: vi.fn().mockResolvedValue(data),
	};
}

/** Retrieve a tool from the registry, throwing if it is missing. */
function getTool(registry: WebMCPRegistry, name: string) {
	const tool = registry.get(name);
	if (!tool) throw new Error(`Tool "${name}" not registered`);
	return tool;
}

describe("registerConversationTools", () => {
	let registry: WebMCPRegistry;
	const API_BASE = "/api";

	beforeEach(() => {
		registry = new WebMCPRegistry();
		mockFetch.mockReset();
	});

	it("should register all 5 tools", () => {
		registerConversationTools(registry, API_BASE);

		const names = registry.list();
		expect(names).toHaveLength(5);
		expect(names).toContain("sendMessage");
		expect(names).toContain("getConversation");
		expect(names).toContain("listSessions");
		expect(names).toContain("newSession");
		expect(names).toContain("getStatus");
	});

	it("should use default apiBase when not provided", () => {
		registerConversationTools(registry);

		expect(registry.list()).toHaveLength(5);
	});

	describe("sendMessage", () => {
		it("should POST to /sessions/:session/inject", async () => {
			const response = { session: "default", response: "Hello!" };
			mockFetch.mockResolvedValue(mockJsonResponse(response));
			registerConversationTools(registry, API_BASE);

			const tool = getTool(registry, "sendMessage");
			const result = await tool.handler(
				{ text: "Hello", sessionId: "my-session" },
				{},
			);

			expect(mockFetch).toHaveBeenCalledWith(
				"/api/sessions/my-session/inject",
				expect.objectContaining({
					method: "POST",
					body: JSON.stringify({ message: "Hello" }),
				}),
			);
			expect(result).toEqual(response);
		});

		it("should default to 'default' session when sessionId is omitted", async () => {
			mockFetch.mockResolvedValue(mockJsonResponse({ response: "ok" }));
			registerConversationTools(registry, API_BASE);

			const tool = getTool(registry, "sendMessage");
			await tool.handler({ text: "Hi" }, {});

			expect(mockFetch).toHaveBeenCalledWith(
				"/api/sessions/default/inject",
				expect.any(Object),
			);
		});

		it("should throw when text parameter is missing", async () => {
			registerConversationTools(registry, API_BASE);

			const tool = getTool(registry, "sendMessage");

			await expect(tool.handler({}, {})).rejects.toThrow(
				"Parameter 'text' is required",
			);
		});

		it("should include bearer token when auth.token is present", async () => {
			mockFetch.mockResolvedValue(mockJsonResponse({ response: "ok" }));
			registerConversationTools(registry, API_BASE);

			const tool = getTool(registry, "sendMessage");
			const auth: AuthContext = { token: "my-secret-token" };
			await tool.handler({ text: "Hi" }, auth);

			const headers = mockFetch.mock.calls[0][1].headers;
			expect(headers.Authorization).toBe("Bearer my-secret-token");
		});

		it("should not include Authorization header when no token", async () => {
			mockFetch.mockResolvedValue(mockJsonResponse({ response: "ok" }));
			registerConversationTools(registry, API_BASE);

			const tool = getTool(registry, "sendMessage");
			await tool.handler({ text: "Hi" }, {});

			const headers = mockFetch.mock.calls[0][1].headers;
			expect(headers.Authorization).toBeUndefined();
		});

		it("should encode special characters in session name", async () => {
			mockFetch.mockResolvedValue(mockJsonResponse({ response: "ok" }));
			registerConversationTools(registry, API_BASE);

			const tool = getTool(registry, "sendMessage");
			await tool.handler({ text: "Hi", sessionId: "session with spaces" }, {});

			expect(mockFetch).toHaveBeenCalledWith(
				"/api/sessions/session%20with%20spaces/inject",
				expect.any(Object),
			);
		});
	});

	describe("getConversation", () => {
		it("should GET /sessions/:sessionId/history", async () => {
			const history = { messages: [{ role: "user", content: "hi" }] };
			mockFetch.mockResolvedValue(mockJsonResponse(history));
			registerConversationTools(registry, API_BASE);

			const tool = getTool(registry, "getConversation");
			const result = await tool.handler({ sessionId: "my-session" }, {});

			expect(mockFetch).toHaveBeenCalledWith(
				"/api/sessions/my-session/history",
				expect.any(Object),
			);
			expect(result).toEqual(history);
		});

		it("should append limit query parameter when provided", async () => {
			mockFetch.mockResolvedValue(mockJsonResponse({ messages: [] }));
			registerConversationTools(registry, API_BASE);

			const tool = getTool(registry, "getConversation");
			await tool.handler({ sessionId: "s1", limit: 10 }, {});

			expect(mockFetch).toHaveBeenCalledWith(
				"/api/sessions/s1/history?limit=10",
				expect.any(Object),
			);
		});

		it("should throw when sessionId is missing", async () => {
			registerConversationTools(registry, API_BASE);

			const tool = getTool(registry, "getConversation");

			await expect(tool.handler({}, {})).rejects.toThrow(
				"Parameter 'sessionId' is required",
			);
		});

		it("should include bearer token in auth header", async () => {
			mockFetch.mockResolvedValue(mockJsonResponse({ messages: [] }));
			registerConversationTools(registry, API_BASE);

			const tool = getTool(registry, "getConversation");
			await tool.handler({ sessionId: "s1" }, { token: "tok-123" });

			const headers = mockFetch.mock.calls[0][1].headers;
			expect(headers.Authorization).toBe("Bearer tok-123");
		});
	});

	describe("listSessions", () => {
		it("should GET /sessions", async () => {
			const sessions = { sessions: [{ name: "default" }, { name: "s2" }] };
			mockFetch.mockResolvedValue(mockJsonResponse(sessions));
			registerConversationTools(registry, API_BASE);

			const tool = getTool(registry, "listSessions");
			const result = await tool.handler({}, {});

			expect(mockFetch).toHaveBeenCalledWith(
				"/api/sessions",
				expect.any(Object),
			);
			expect(result).toEqual(sessions);
		});

		it("should include bearer token in auth header", async () => {
			mockFetch.mockResolvedValue(mockJsonResponse({ sessions: [] }));
			registerConversationTools(registry, API_BASE);

			const tool = getTool(registry, "listSessions");
			await tool.handler({}, { token: "tok-abc" });

			const headers = mockFetch.mock.calls[0][1].headers;
			expect(headers.Authorization).toBe("Bearer tok-abc");
		});
	});

	describe("newSession", () => {
		it("should POST /sessions with generated name", async () => {
			const session = { name: "session-1234", id: "abc" };
			mockFetch.mockResolvedValue(mockJsonResponse(session));
			registerConversationTools(registry, API_BASE);

			const tool = getTool(registry, "newSession");
			const result = await tool.handler({}, {});

			expect(mockFetch).toHaveBeenCalledWith(
				"/api/sessions",
				expect.objectContaining({ method: "POST" }),
			);
			const body = JSON.parse(mockFetch.mock.calls[0][1].body);
			expect(body.name).toMatch(/^session-\d+$/);
			expect(body.context).toBeUndefined();
			expect(result).toEqual(session);
		});

		it("should include model context when model param is provided", async () => {
			mockFetch.mockResolvedValue(mockJsonResponse({ name: "s1" }));
			registerConversationTools(registry, API_BASE);

			const tool = getTool(registry, "newSession");
			await tool.handler({ model: "claude-sonnet-4-5-20250929" }, {});

			const body = JSON.parse(mockFetch.mock.calls[0][1].body);
			expect(body.context).toBe("Use model: claude-sonnet-4-5-20250929");
		});

		it("should include bearer token in auth header", async () => {
			mockFetch.mockResolvedValue(mockJsonResponse({ name: "s1" }));
			registerConversationTools(registry, API_BASE);

			const tool = getTool(registry, "newSession");
			await tool.handler({}, { token: "tok-xyz" });

			const headers = mockFetch.mock.calls[0][1].headers;
			expect(headers.Authorization).toBe("Bearer tok-xyz");
		});
	});

	describe("getStatus", () => {
		it("should GET /status", async () => {
			const status = {
				healthy: true,
				plugins: ["discord"],
				uptime: 3600,
			};
			mockFetch.mockResolvedValue(mockJsonResponse(status));
			registerConversationTools(registry, API_BASE);

			const tool = getTool(registry, "getStatus");
			const result = await tool.handler({}, {});

			expect(mockFetch).toHaveBeenCalledWith("/api/status", expect.any(Object));
			expect(result).toEqual(status);
		});

		it("should include bearer token in auth header", async () => {
			mockFetch.mockResolvedValue(mockJsonResponse({ healthy: true }));
			registerConversationTools(registry, API_BASE);

			const tool = getTool(registry, "getStatus");
			await tool.handler({}, { token: "tok-status" });

			const headers = mockFetch.mock.calls[0][1].headers;
			expect(headers.Authorization).toBe("Bearer tok-status");
		});
	});

	describe("error handling", () => {
		it("should throw on non-ok response with error from body", async () => {
			mockFetch.mockResolvedValue(
				mockJsonResponse({ error: "Session not found" }, false, 404),
			);
			registerConversationTools(registry, API_BASE);

			const tool = getTool(registry, "listSessions");

			await expect(tool.handler({}, {})).rejects.toThrow("Session not found");
		});

		it("should throw generic error when body has no error field", async () => {
			mockFetch.mockResolvedValue(mockJsonResponse({}, false, 500));
			registerConversationTools(registry, API_BASE);

			const tool = getTool(registry, "getStatus");

			await expect(tool.handler({}, {})).rejects.toThrow(
				"Request failed (500)",
			);
		});

		it("should throw generic error when body is not JSON", async () => {
			mockFetch.mockResolvedValue({
				ok: false,
				status: 502,
				json: vi.fn().mockRejectedValue(new Error("not json")),
			});
			registerConversationTools(registry, API_BASE);

			const tool = getTool(registry, "getStatus");

			await expect(tool.handler({}, {})).rejects.toThrow("Request failed");
		});
	});

	describe("tool metadata", () => {
		it("sendMessage should have correct parameter definitions", () => {
			registerConversationTools(registry, API_BASE);
			const tool = getTool(registry, "sendMessage");

			expect(tool.parameters?.text?.type).toBe("string");
			expect(tool.parameters?.text?.required).toBe(true);
			expect(tool.parameters?.sessionId?.type).toBe("string");
			expect(tool.parameters?.sessionId?.required).toBe(false);
		});

		it("getConversation should have correct parameter definitions", () => {
			registerConversationTools(registry, API_BASE);
			const tool = getTool(registry, "getConversation");

			expect(tool.parameters?.sessionId?.type).toBe("string");
			expect(tool.parameters?.sessionId?.required).toBe(true);
			expect(tool.parameters?.limit?.type).toBe("number");
			expect(tool.parameters?.limit?.required).toBe(false);
		});

		it("listSessions should have empty parameters", () => {
			registerConversationTools(registry, API_BASE);
			const tool = getTool(registry, "listSessions");

			expect(tool.parameters).toEqual({});
		});

		it("newSession should have optional model parameter", () => {
			registerConversationTools(registry, API_BASE);
			const tool = getTool(registry, "newSession");

			expect(tool.parameters?.model?.type).toBe("string");
			expect(tool.parameters?.model?.required).toBe(false);
		});

		it("getStatus should have empty parameters", () => {
			registerConversationTools(registry, API_BASE);
			const tool = getTool(registry, "getStatus");

			expect(tool.parameters).toEqual({});
		});
	});

	describe("custom apiBase", () => {
		it("should use custom apiBase for all requests", async () => {
			mockFetch.mockResolvedValue(mockJsonResponse({ sessions: [] }));
			registerConversationTools(registry, "http://localhost:7437/api");

			const tool = getTool(registry, "listSessions");
			await tool.handler({}, {});

			expect(mockFetch).toHaveBeenCalledWith(
				"http://localhost:7437/api/sessions",
				expect.any(Object),
			);
		});
	});
});
