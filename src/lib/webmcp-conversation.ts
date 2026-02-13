/**
 * WebMCP Conversation & Session Tools
 *
 * Registers 5 tools on the WebMCP registry for AI agents to chat with
 * the WOPR bot and manage sessions from the browser.
 */

import type { AuthContext, WebMCPRegistry } from "./webmcp";

// -- Internal helpers --

interface RequestOptions {
	method?: string;
	body?: string;
	headers?: Record<string, string>;
}

async function daemonRequest<T>(
	apiBase: string,
	path: string,
	auth: AuthContext,
	options?: RequestOptions,
): Promise<T> {
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
		...options?.headers,
	};
	if (auth.token) {
		headers.Authorization = `Bearer ${auth.token as string}`;
	}
	const res = await fetch(`${apiBase}${path}`, {
		...options,
		headers,
	});
	if (!res.ok) {
		const err = await res.json().catch(() => ({ error: "Request failed" }));
		throw new Error(
			(err as { error?: string }).error || `Request failed (${res.status})`,
		);
	}
	return res.json() as Promise<T>;
}

// -- Tool registration --

/**
 * Register all 5 conversation/session WebMCP tools on the given registry.
 *
 * @param registry - The WebMCPRegistry instance to register tools on
 * @param apiBase  - Base URL of the WOPR daemon API (e.g. "/api" or "http://localhost:3000/api")
 */
export function registerConversationTools(
	registry: WebMCPRegistry,
	apiBase = "/api",
): void {
	// 1. sendMessage
	registry.register({
		name: "sendMessage",
		description: "Send a message to the WOPR bot and return the full response.",
		parameters: {
			text: {
				type: "string",
				description: "The message text to send",
				required: true,
			},
			sessionId: {
				type: "string",
				description:
					"Session name to send the message in. If omitted, uses the default session.",
				required: false,
			},
		},
		handler: async (params: Record<string, unknown>, auth: AuthContext) => {
			const text = params.text as string;
			if (!text) {
				throw new Error("Parameter 'text' is required");
			}
			const session = (params.sessionId as string) || "default";
			return daemonRequest(
				apiBase,
				`/sessions/${encodeURIComponent(session)}/inject`,
				auth,
				{
					method: "POST",
					body: JSON.stringify({ message: text }),
				},
			);
		},
	});

	// 2. getConversation
	registry.register({
		name: "getConversation",
		description: "Get the conversation history for a session.",
		parameters: {
			sessionId: {
				type: "string",
				description: "Session name to retrieve history for",
				required: true,
			},
			limit: {
				type: "number",
				description: "Maximum number of messages to return. Omit for all.",
				required: false,
			},
		},
		handler: async (params: Record<string, unknown>, auth: AuthContext) => {
			const sessionId = params.sessionId as string;
			if (!sessionId) {
				throw new Error("Parameter 'sessionId' is required");
			}
			const qs = params.limit ? `?limit=${encodeURIComponent(String(params.limit))}` : "";
			return daemonRequest(
				apiBase,
				`/sessions/${encodeURIComponent(sessionId)}/history${qs}`,
				auth,
			);
		},
	});

	// 3. listSessions
	registry.register({
		name: "listSessions",
		description: "List all chat sessions.",
		parameters: {},
		handler: async (_params: Record<string, unknown>, auth: AuthContext) => {
			return daemonRequest(apiBase, "/sessions", auth);
		},
	});

	// 4. newSession
	registry.register({
		name: "newSession",
		description: "Start a new chat session with an optional model override.",
		parameters: {
			model: {
				type: "string",
				description:
					"Model identifier to use for this session (e.g. 'claude-sonnet-4-5-20250929'). Omit for default.",
				required: false,
			},
		},
		handler: async (params: Record<string, unknown>, auth: AuthContext) => {
			const name = `session-${Date.now()}`;
			const body: Record<string, unknown> = { name };
			if (params.model) {
				body.context = `Use model: ${params.model}`;
			}
			return daemonRequest(apiBase, "/sessions", auth, {
				method: "POST",
				body: JSON.stringify(body),
			});
		},
	});

	// 5. getStatus
	registry.register({
		name: "getStatus",
		description:
			"Get instance health, loaded plugins, connected channels, and uptime.",
		parameters: {},
		handler: async (_params: Record<string, unknown>, auth: AuthContext) => {
			return daemonRequest(apiBase, "/status", auth);
		},
	});
}
