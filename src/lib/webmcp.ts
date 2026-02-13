/**
 * WebMCP Registration Framework
 *
 * Provides a registry for plugins to register browser-side MCP tools
 * via the navigator.modelContext API. Supports manifest-driven declaration
 * and dynamic registration/unregistration on plugin load/unload.
 */

// -- Types --

export interface ParameterSchema {
	type: string;
	description?: string;
	required?: boolean;
	enum?: string[];
	default?: unknown;
}

export interface AuthContext {
	userId?: string;
	sessionId?: string;
	roles?: string[];
	[key: string]: unknown;
}

export type WebMCPHandler = (
	params: Record<string, unknown>,
	auth: AuthContext,
) => unknown | Promise<unknown>;

export interface WebMCPTool {
	name: string;
	description: string;
	parameters?: Record<string, ParameterSchema>;
	handler: WebMCPHandler;
}

export interface WebMCPToolDeclaration {
	name: string;
	description: string;
	parameters?: Record<string, ParameterSchema>;
}

// -- Navigator type augmentation for modelContext --

interface ModelContextAPI {
	registerTool(tool: {
		name: string;
		description: string;
		parameters?: Record<string, ParameterSchema>;
		handler: (params: Record<string, unknown>) => unknown | Promise<unknown>;
	}): void;
	unregisterTool(name: string): void;
}

function getModelContext(): ModelContextAPI | undefined {
	const nav = globalThis.navigator as
		| (Navigator & { modelContext?: ModelContextAPI })
		| undefined;
	if (
		nav?.modelContext &&
		typeof nav.modelContext.registerTool === "function"
	) {
		return nav.modelContext;
	}
	return undefined;
}

// -- Plugin interfaces for manifest-driven registration --

export interface WebMCPPlugin {
	getManifest(): { webmcpTools?: WebMCPToolDeclaration[] };
	getWebMCPHandlers?(): Record<string, WebMCPHandler>;
}

// -- Registry --

export class WebMCPRegistry {
	private tools: Map<string, WebMCPTool> = new Map();
	private authContext: AuthContext = {};

	/** Check whether the browser supports navigator.modelContext */
	isSupported(): boolean {
		return getModelContext() !== undefined;
	}

	/** Set the auth context that will be passed to all tool handlers */
	setAuthContext(auth: AuthContext): void {
		this.authContext = { ...auth };
	}

	/** Get the current auth context */
	getAuthContext(): AuthContext {
		return { ...this.authContext };
	}

	/** Register a single WebMCP tool */
	register(tool: WebMCPTool): void {
		const mc = getModelContext();
		if (mc) {
			mc.registerTool({
				name: tool.name,
				description: tool.description,
				parameters: tool.parameters,
				handler: (params: Record<string, unknown>) =>
					tool.handler(params, this.authContext),
			});
		}
		this.tools.set(tool.name, tool);
	}

	/** Unregister a tool by name */
	unregister(name: string): void {
		const mc = getModelContext();
		if (mc) {
			mc.unregisterTool(name);
		}
		this.tools.delete(name);
	}

	/** Get a registered tool by name */
	get(name: string): WebMCPTool | undefined {
		return this.tools.get(name);
	}

	/** List all registered tool names */
	list(): string[] {
		return Array.from(this.tools.keys());
	}

	/** Number of registered tools */
	get size(): number {
		return this.tools.size;
	}

	/** Unregister all tools */
	clear(): void {
		for (const name of this.tools.keys()) {
			const mc = getModelContext();
			if (mc) {
				mc.unregisterTool(name);
			}
		}
		this.tools.clear();
	}

	/**
	 * Register all WebMCP tools declared in a plugin's manifest.
	 * Merges manifest declarations with runtime handlers from getWebMCPHandlers().
	 */
	registerPlugin(plugin: WebMCPPlugin): void {
		const manifest = plugin.getManifest();
		const declarations = manifest.webmcpTools;
		if (!declarations || declarations.length === 0) {
			return;
		}

		const handlers = plugin.getWebMCPHandlers?.() ?? {};

		for (const decl of declarations) {
			const handler = handlers[decl.name];
			if (typeof handler !== "function") {
				continue;
			}
			this.register({
				name: decl.name,
				description: decl.description,
				parameters: decl.parameters,
				handler,
			});
		}
	}

	/**
	 * Unregister all WebMCP tools declared in a plugin's manifest.
	 */
	unregisterPlugin(plugin: WebMCPPlugin): void {
		const manifest = plugin.getManifest();
		const declarations = manifest.webmcpTools ?? [];
		for (const decl of declarations) {
			this.unregister(decl.name);
		}
	}
}

/**
 * Wire up dynamic plugin lifecycle events to the registry.
 *
 * Listens to plugin:loaded and plugin:unloaded events on an event bus
 * and automatically registers/unregisters WebMCP tools.
 */
export function bindPluginLifecycle(
	registry: WebMCPRegistry,
	eventBus: {
		on(event: string, handler: (...args: unknown[]) => void): void;
	},
): void {
	eventBus.on("plugin:loaded", (plugin: WebMCPPlugin) => {
		registry.registerPlugin(plugin);
	});

	eventBus.on("plugin:unloaded", (plugin: WebMCPPlugin) => {
		registry.unregisterPlugin(plugin);
	});
}
