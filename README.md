# WOPR Web UI Plugin

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![WOPR](https://img.shields.io/badge/WOPR-Plugin-blue)](https://github.com/TSavo/wopr)

React-based web dashboard for [WOPR](https://github.com/TSavo/wopr). Built with SolidJS, TailwindCSS, and Vite.

> Part of the [WOPR](https://github.com/TSavo/wopr) ecosystem - Self-sovereign AI session management over P2P.

## Features

- **Session Management**: Create, select, and chat with WOPR sessions
- **Plugin Extensions**: Displays UI components from installed plugins
- **Real-time Streaming**: WebSocket connection for live response streaming
- **Settings Panel**: Configure daemon and view plugin settings
- **Responsive Design**: Works on desktop and mobile

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
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Configuration

The plugin stores configuration under `plugins.data.webui`:

```json
{
  "port": 3000,
  "host": "127.0.0.1"
}
```

## Architecture

- **SolidJS**: Reactive UI framework
- **TailwindCSS**: Utility-first styling
- **Vite**: Build tool and dev server
- **WebSocket**: Real-time communication with WOPR daemon
- **Plugin System**: Extensible via `registerUiComponent()` API

## Plugin Extension Points

Other plugins can extend the UI via:

```javascript
ctx.registerUiComponent({
  id: "my-panel",
  title: "My Plugin",
  moduleUrl: "http://localhost:7332/ui.js",
  slot: "settings", // or 'sidebar', 'chat-header', etc.
});
```

## License

MIT
