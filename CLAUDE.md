# wopr-plugin-webui

Web UI plugin for WOPR — React-based local dashboard for sessions, plugins, and configuration.

## Commands

```bash
npm run build     # tsc
npm run check     # biome check + tsc --noEmit (run before committing)
npm run format    # biome format --write src/
npm test          # vitest run
```

## Architecture

```
src/
  index.tsx       # Plugin entry — registers web server, serves React app
  App.tsx         # Root React component
  index.css       # Global styles
  components/     # UI components (sessions, plugin panels, config forms)
  lib/            # Shared utilities
```

## Key Details

- Serves a local React SPA on a configurable port (default: 3001)
- Other plugins can register UI panels via `WOPRPluginContext.registerPanel()`
- This is the **local embedded UI** — separate from `wopr-platform-ui` (the cloud SaaS platform)
- Dark mode only — this is a developer/admin tool, not end-user facing
- **Distinction**: `wopr-plugin-webui` = local admin panel bundled with the bot. `wopr-platform-ui` = cloud SaaS dashboard at wopr.network.

## Plugin Contract

Imports only from `@wopr-network/plugin-types`. Never import from `@wopr-network/wopr` core.

## Issue Tracking

All issues in **Linear** (team: WOPR). Issue descriptions start with `**Repo:** wopr-network/wopr-plugin-webui`.
