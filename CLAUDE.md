# wopr-plugin-webui

`@wopr-network/wopr-plugin-webui` — SolidJS-based local admin dashboard for WOPR.

## Commands

```bash
npm run build        # vite build + tsc (UI + plugin entry)
npm run build:ui     # vite build (SolidJS frontend only)
npm run build:plugin # tsc -p tsconfig.plugin.json (plugin entry only)
npm run check        # biome check + tsc --noEmit (run before committing)
npm run lint:fix     # biome check --fix src/plugin.ts tests/
npm run format       # biome format --write src/plugin.ts tests/
npm test             # vitest run
```

**Linter/formatter is Biome.** Never add ESLint/Prettier config.

## Architecture

```
src/
  plugin.ts       # Plugin entry — exports WOPRPlugin default, starts HTTP server
  App.tsx          # Root SolidJS component
  index.tsx        # SolidJS render entry
  index.css        # Global styles (Tailwind)
  components/      # UI components (settings panel)
  lib/             # API client, shared utilities
tests/
  plugin.test.ts   # Plugin lifecycle tests
```

## Key Details

- Serves a local SolidJS SPA on a configurable port (default: 3000)
- Other plugins can register UI panels via `WOPRPluginContext.registerUiComponent()`
- This is the **local embedded UI** — separate from `wopr-platform-ui` (the cloud SaaS platform)
- Dark mode only — this is a developer/admin tool, not end-user facing
- **Distinction**: `wopr-plugin-webui` = local admin panel bundled with the bot. `wopr-platform-ui` = cloud SaaS dashboard at wopr.network.

## Plugin Contract

Imports only from `@wopr-network/plugin-types`. Never import from `@wopr-network/wopr` core.

## Issue Tracking

All issues in **Linear** (team: WOPR). Issue descriptions start with `**Repo:** wopr-network/wopr-plugin-webui`.
