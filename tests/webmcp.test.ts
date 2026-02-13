import { describe, it, expect, vi, beforeEach } from "vitest";
import {
	WebMCPRegistry,
	bindPluginLifecycle,
	type WebMCPTool,
	type WebMCPPlugin,
	type AuthContext,
} from "../src/lib/webmcp";

// Helper: set up a mock navigator.modelContext
function installModelContext() {
	const mc = {
		registerTool: vi.fn(),
		unregisterTool: vi.fn(),
	};
	Object.defineProperty(globalThis, "navigator", {
		value: { modelContext: mc },
		writable: true,
		configurable: true,
	});
	return mc;
}

function removeModelContext() {
	Object.defineProperty(globalThis, "navigator", {
		value: undefined,
		writable: true,
		configurable: true,
	});
}

function makeTool(overrides: Partial<WebMCPTool> = {}): WebMCPTool {
	return {
		name: "test-tool",
		description: "A test tool",
		handler: vi.fn().mockReturnValue("result"),
		...overrides,
	};
}

function makePlugin(
	tools: { name: string; description: string; parameters?: Record<string, any> }[] = [],
	handlers: Record<string, (...args: any[]) => any> = {},
): WebMCPPlugin {
	return {
		getManifest: () => ({ webmcpTools: tools }),
		getWebMCPHandlers: () => handlers,
	};
}

// -- Tests --

describe("WebMCPRegistry", () => {
	let registry: WebMCPRegistry;

	beforeEach(() => {
		registry = new WebMCPRegistry();
		removeModelContext();
	});

	describe("isSupported", () => {
		it("should return false when navigator is undefined", () => {
			expect(registry.isSupported()).toBe(false);
		});

		it("should return false when navigator.modelContext is undefined", () => {
			Object.defineProperty(globalThis, "navigator", {
				value: {},
				writable: true,
				configurable: true,
			});
			expect(registry.isSupported()).toBe(false);
		});

		it("should return false when registerTool is not a function", () => {
			Object.defineProperty(globalThis, "navigator", {
				value: { modelContext: { registerTool: "not a function" } },
				writable: true,
				configurable: true,
			});
			expect(registry.isSupported()).toBe(false);
		});

		it("should return true when navigator.modelContext.registerTool is a function", () => {
			installModelContext();
			expect(registry.isSupported()).toBe(true);
		});
	});

	describe("register", () => {
		it("should add tool to internal map regardless of modelContext support", () => {
			const tool = makeTool();
			registry.register(tool);

			expect(registry.get("test-tool")).toBe(tool);
			expect(registry.size).toBe(1);
		});

		it("should call navigator.modelContext.registerTool when supported", () => {
			const mc = installModelContext();
			const tool = makeTool({
				parameters: { query: { type: "string", description: "Search query" } },
			});

			registry.register(tool);

			expect(mc.registerTool).toHaveBeenCalledTimes(1);
			const registered = mc.registerTool.mock.calls[0][0];
			expect(registered.name).toBe("test-tool");
			expect(registered.description).toBe("A test tool");
			expect(registered.parameters).toEqual({
				query: { type: "string", description: "Search query" },
			});
			expect(typeof registered.handler).toBe("function");
		});

		it("should not call navigator.modelContext.registerTool when unsupported", () => {
			const tool = makeTool();
			// no modelContext installed
			registry.register(tool);
			// should not throw, tool is still tracked
			expect(registry.size).toBe(1);
		});

		it("should overwrite an existing tool with the same name", () => {
			const tool1 = makeTool({ handler: vi.fn() });
			const tool2 = makeTool({ description: "updated", handler: vi.fn() });

			registry.register(tool1);
			registry.register(tool2);

			expect(registry.size).toBe(1);
			expect(registry.get("test-tool")?.description).toBe("updated");
		});
	});

	describe("unregister", () => {
		it("should remove tool from internal map", () => {
			registry.register(makeTool());
			expect(registry.size).toBe(1);

			registry.unregister("test-tool");
			expect(registry.size).toBe(0);
			expect(registry.get("test-tool")).toBeUndefined();
		});

		it("should call navigator.modelContext.unregisterTool when supported", () => {
			const mc = installModelContext();
			registry.register(makeTool());

			registry.unregister("test-tool");

			expect(mc.unregisterTool).toHaveBeenCalledWith("test-tool");
		});

		it("should be a no-op for non-existent tool name", () => {
			registry.unregister("no-such-tool");
			expect(registry.size).toBe(0);
		});
	});

	describe("list", () => {
		it("should return empty array when no tools registered", () => {
			expect(registry.list()).toEqual([]);
		});

		it("should return all registered tool names", () => {
			registry.register(makeTool({ name: "alpha" }));
			registry.register(makeTool({ name: "beta" }));
			registry.register(makeTool({ name: "gamma" }));

			const names = registry.list();
			expect(names).toHaveLength(3);
			expect(names).toContain("alpha");
			expect(names).toContain("beta");
			expect(names).toContain("gamma");
		});
	});

	describe("clear", () => {
		it("should remove all tools", () => {
			registry.register(makeTool({ name: "a" }));
			registry.register(makeTool({ name: "b" }));

			registry.clear();

			expect(registry.size).toBe(0);
			expect(registry.list()).toEqual([]);
		});

		it("should call unregisterTool for each tool when modelContext is available", () => {
			const mc = installModelContext();
			registry.register(makeTool({ name: "a" }));
			registry.register(makeTool({ name: "b" }));

			registry.clear();

			expect(mc.unregisterTool).toHaveBeenCalledWith("a");
			expect(mc.unregisterTool).toHaveBeenCalledWith("b");
		});
	});

	describe("auth context", () => {
		it("should start with an empty auth context", () => {
			expect(registry.getAuthContext()).toEqual({});
		});

		it("should set and return auth context", () => {
			const auth: AuthContext = { userId: "u1", sessionId: "s1", roles: ["admin"] };
			registry.setAuthContext(auth);

			expect(registry.getAuthContext()).toEqual(auth);
		});

		it("should not expose internal reference via getAuthContext", () => {
			registry.setAuthContext({ userId: "u1" });
			const ctx = registry.getAuthContext();
			ctx.userId = "mutated";

			expect(registry.getAuthContext().userId).toBe("u1");
		});

		it("should pass auth context to tool handler via modelContext wrapper", () => {
			const mc = installModelContext();
			const handler = vi.fn();
			registry.setAuthContext({ userId: "user-42", roles: ["viewer"] });
			registry.register(makeTool({ handler }));

			// Simulate browser calling the registered handler
			const registeredHandler = mc.registerTool.mock.calls[0][0].handler;
			registeredHandler({ query: "hello" });

			expect(handler).toHaveBeenCalledWith(
				{ query: "hello" },
				{ userId: "user-42", roles: ["viewer"] },
			);
		});

		it("should use the current auth context at call time, not registration time", () => {
			const mc = installModelContext();
			const handler = vi.fn();

			registry.setAuthContext({ userId: "before" });
			registry.register(makeTool({ handler }));

			// Change auth after registration -- the closure references the
			// registry's authContext property, so handler sees current state at call time
			registry.setAuthContext({ userId: "after" });

			const registeredHandler = mc.registerTool.mock.calls[0][0].handler;
			registeredHandler({});

			// Handler should see the updated auth context, not the stale one
			expect(handler).toHaveBeenCalledWith({}, { userId: "after" });
		});
	});

	describe("registerPlugin", () => {
		it("should register tools from a plugin manifest with matching handlers", () => {
			const handler = vi.fn();
			const plugin = makePlugin(
				[{ name: "search", description: "Search the web" }],
				{ search: handler },
			);

			registry.registerPlugin(plugin);

			expect(registry.size).toBe(1);
			expect(registry.get("search")).toBeDefined();
			expect(registry.get("search")?.handler).toBe(handler);
		});

		it("should skip tools without a matching handler", () => {
			const plugin = makePlugin(
				[
					{ name: "has-handler", description: "Good" },
					{ name: "no-handler", description: "Skipped" },
				],
				{ "has-handler": vi.fn() },
			);

			registry.registerPlugin(plugin);

			expect(registry.size).toBe(1);
			expect(registry.get("has-handler")).toBeDefined();
			expect(registry.get("no-handler")).toBeUndefined();
		});

		it("should handle plugin with no webmcpTools in manifest", () => {
			const plugin: WebMCPPlugin = {
				getManifest: () => ({}),
			};

			registry.registerPlugin(plugin);

			expect(registry.size).toBe(0);
		});

		it("should handle plugin with empty webmcpTools array", () => {
			const plugin = makePlugin([], {});

			registry.registerPlugin(plugin);

			expect(registry.size).toBe(0);
		});

		it("should handle plugin without getWebMCPHandlers method", () => {
			const plugin: WebMCPPlugin = {
				getManifest: () => ({
					webmcpTools: [{ name: "tool1", description: "Desc" }],
				}),
				// no getWebMCPHandlers
			};

			registry.registerPlugin(plugin);

			// No handlers, so nothing registered
			expect(registry.size).toBe(0);
		});

		it("should pass parameters from declaration to registered tool", () => {
			const handler = vi.fn();
			const params = { query: { type: "string", description: "Search query", required: true } };
			const plugin = makePlugin(
				[{ name: "search", description: "Search", parameters: params }],
				{ search: handler },
			);

			registry.registerPlugin(plugin);

			expect(registry.get("search")?.parameters).toEqual(params);
		});
	});

	describe("unregisterPlugin", () => {
		it("should unregister all tools declared in a plugin manifest", () => {
			const plugin = makePlugin(
				[
					{ name: "tool-a", description: "A" },
					{ name: "tool-b", description: "B" },
				],
				{ "tool-a": vi.fn(), "tool-b": vi.fn() },
			);

			registry.registerPlugin(plugin);
			expect(registry.size).toBe(2);

			registry.unregisterPlugin(plugin);
			expect(registry.size).toBe(0);
		});

		it("should handle plugin with no webmcpTools gracefully", () => {
			const plugin: WebMCPPlugin = {
				getManifest: () => ({}),
			};

			registry.unregisterPlugin(plugin);
			expect(registry.size).toBe(0);
		});

		it("should only remove tools declared by that plugin", () => {
			registry.register(makeTool({ name: "independent-tool" }));

			const plugin = makePlugin(
				[{ name: "plugin-tool", description: "X" }],
				{ "plugin-tool": vi.fn() },
			);
			registry.registerPlugin(plugin);
			expect(registry.size).toBe(2);

			registry.unregisterPlugin(plugin);
			expect(registry.size).toBe(1);
			expect(registry.get("independent-tool")).toBeDefined();
		});
	});
});

describe("bindPluginLifecycle", () => {
	let registry: WebMCPRegistry;

	beforeEach(() => {
		registry = new WebMCPRegistry();
		removeModelContext();
	});

	it("should register plugin tools on plugin:loaded event", () => {
		const listeners: Record<string, ((...args: any[]) => void)[]> = {};
		const eventBus = {
			on: (event: string, handler: (...args: any[]) => void) => {
				listeners[event] = listeners[event] || [];
				listeners[event].push(handler);
			},
		};

		bindPluginLifecycle(registry, eventBus);

		const plugin = makePlugin(
			[{ name: "new-tool", description: "A new tool" }],
			{ "new-tool": vi.fn() },
		);

		// Simulate plugin:loaded event
		for (const handler of listeners["plugin:loaded"] ?? []) {
			handler(plugin);
		}

		expect(registry.size).toBe(1);
		expect(registry.get("new-tool")).toBeDefined();
	});

	it("should unregister plugin tools on plugin:unloaded event", () => {
		const listeners: Record<string, ((...args: any[]) => void)[]> = {};
		const eventBus = {
			on: (event: string, handler: (...args: any[]) => void) => {
				listeners[event] = listeners[event] || [];
				listeners[event].push(handler);
			},
		};

		bindPluginLifecycle(registry, eventBus);

		const plugin = makePlugin(
			[{ name: "ephemeral", description: "Temporary" }],
			{ ephemeral: vi.fn() },
		);

		// Load then unload
		for (const handler of listeners["plugin:loaded"] ?? []) {
			handler(plugin);
		}
		expect(registry.size).toBe(1);

		for (const handler of listeners["plugin:unloaded"] ?? []) {
			handler(plugin);
		}
		expect(registry.size).toBe(0);
	});

	it("should handle multiple plugins loading and unloading", () => {
		const listeners: Record<string, ((...args: any[]) => void)[]> = {};
		const eventBus = {
			on: (event: string, handler: (...args: any[]) => void) => {
				listeners[event] = listeners[event] || [];
				listeners[event].push(handler);
			},
		};

		bindPluginLifecycle(registry, eventBus);

		const pluginA = makePlugin(
			[{ name: "tool-a", description: "A" }],
			{ "tool-a": vi.fn() },
		);
		const pluginB = makePlugin(
			[{ name: "tool-b", description: "B" }],
			{ "tool-b": vi.fn() },
		);

		for (const handler of listeners["plugin:loaded"] ?? []) {
			handler(pluginA);
			handler(pluginB);
		}
		expect(registry.size).toBe(2);

		// Unload only pluginA
		for (const handler of listeners["plugin:unloaded"] ?? []) {
			handler(pluginA);
		}
		expect(registry.size).toBe(1);
		expect(registry.get("tool-b")).toBeDefined();
	});
});
