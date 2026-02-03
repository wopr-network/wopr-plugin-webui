# WOPR Web UI Plugin

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![WOPR](https://img.shields.io/badge/WOPR-Plugin-blue)](https://github.com/TSavo/wopr)

Web dashboard for [WOPR](https://github.com/TSavo/wopr). Built with SolidJS, TailwindCSS, and Vite.

> Part of the [WOPR](https://github.com/TSavo/wopr) ecosystem - Self-sovereign AI session management over P2P.

## Features

- **Session Management**: Create, select, and chat with WOPR sessions
- **Real-time Streaming**: WebSocket connection for live response streaming
- **Settings Panel**: Configure daemon, Anthropic API, OAuth, Discord bot, discovery, and plugins
- **Plugin Extensions**: Displays UI components from installed plugins in multiple slots
- **Responsive Design**: Dark theme with custom styling, works on desktop and mobile

## Installation

```bash
# Install dependencies
npm install

# Build the UI
npm run build

# Install as WOPR plugin
wopr plugin install ./wopr-plugin-webui
wopr plugin enable webui
```

## Development

```bash
# Start development server (proxies API to localhost:7437)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

The dev server runs on port 3000 and proxies `/api` requests to `http://127.0.0.1:7437` and `/ws` WebSocket connections to `ws://127.0.0.1:7437`.

## Configuration

The plugin accepts these configuration options:

```json
{
  "port": 3000,
  "host": "127.0.0.1"
}
```

These control where the built web UI is served from when running as a WOPR plugin.

## Architecture

- **SolidJS**: Reactive UI framework with fine-grained reactivity
- **TailwindCSS**: Utility-first styling with custom WOPR theme
- **Vite**: Build tool and dev server with HMR
- **WebSocket**: Real-time streaming from WOPR daemon
- **Plugin System**: Extensible via `registerWebUiExtension()` and `registerUiComponent()` APIs

## API Client

The UI communicates with the WOPR daemon via REST API (`/api/*`) and WebSocket (`/ws`).

### Available Endpoints

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `/api/sessions` | GET, POST | List and create sessions |
| `/api/sessions/:name` | DELETE | Delete a session |
| `/api/sessions/:name/inject` | POST | Inject a message into a session |
| `/api/auth` | GET | Check authentication status |
| `/api/crons` | GET, POST | List and create scheduled tasks |
| `/api/crons/:name` | DELETE | Delete a scheduled task |
| `/api/peers` | GET | List connected P2P peers |
| `/api/plugins` | GET | List installed plugins |
| `/api/plugins/ui` | GET | Get web UI extensions |
| `/api/plugins/components` | GET | Get UI component extensions |
| `/api/identity` | GET, POST | Get or initialize identity |
| `/api/config` | GET, DELETE | Get config or reset to defaults |
| `/api/config/:key` | GET, PUT | Get or set config value |

### WebSocket Events

Connect to `/ws` and send:
```json
{ "type": "subscribe", "sessions": ["*"] }
```

Receive streaming events:
```typescript
interface StreamEvent {
  type: "stream" | "injection" | "connected" | "subscribed";
  session?: string;
  from?: string;
  message: {
    type: "text" | "tool_use" | "complete" | "error";
    content: string;
    toolName?: string;
  };
  ts?: number;
}
```

## Plugin Extension Points

### Web UI Extensions

Other plugins can register external UI links:

```javascript
ctx.registerWebUiExtension({
  id: "my-extension",
  title: "My Plugin",
  url: "http://localhost:7332/",
  description: "My plugin dashboard",
  category: "tools"
});
```

### UI Component Extensions

Plugins can inject components into specific slots:

```javascript
ctx.registerUiComponent({
  id: "my-panel",
  title: "My Plugin Panel",
  moduleUrl: "http://localhost:7332/ui.js",
  slot: "settings",  // sidebar | settings | statusbar | chat-header | chat-footer
  description: "Custom settings panel"
});
```

Component modules receive these props:

```typescript
interface PluginUiComponentProps {
  api: {
    getSessions: () => Promise<{ sessions: Session[] }>;
    inject: (session: string, message: string) => Promise<InjectResponse>;
    getConfig: () => Promise<WoprConfig>;
    setConfigValue: (key: string, value: any) => Promise<void>;
  };
  currentSession?: string;
  pluginConfig: any;
  saveConfig: (config: any) => Promise<void>;
}
```

## Settings Panel

The Settings view allows configuration of:

- **Daemon**: Port, host, auto-start
- **Anthropic**: API key for Claude integration
- **OAuth**: Client credentials for claude.ai login
- **Discord**: Bot token and guild ID
- **Discovery**: P2P topic subscriptions and auto-join
- **Plugins**: Auto-load behavior

## License

MIT
