# Workspace File Server (Astro)

This is Nick's personal site converted into a workspace file browser. It serves files from `/claw/workspace` with the look and feel of nickyt.co.

## Features

- ✨ Beautiful UI with dark mode support
- 📁 Directory browsing with icons
- 🔒 Respects merged ignore patterns (`.gitignore`, `.clawspace-ignore`, env)
- 🚫 Blocks internal files by default (`SOUL.md`, `AGENTS.md`, `.env`, etc.)
- 🎨 Uses your personal site's styling and layout

## Quick Start

```bash
# Development mode (hot reload)
npm run dev

# Or use the start script
./start.sh 6789

# Production build
npm run build
npm run preview
```

## How It Works

- **SSR Mode**: Runs Astro in server mode with Node adapter
- **Dynamic Routes**:
  - `src/pages/index.astro` - Root directory listing
  - `src/pages/[...path].astro` - Catch-all route for subdirectories and files
- **Security**: Same .gitignore rules and internal file blocking as the old Node.js server

## Configuration

By default, Clawspace serves from the parent of this app directory. For nonstandard paths, set `CLAWSPACE_ROOT`.

```bash
CLAWSPACE_ROOT=/absolute/path/to/workspace
CLAWSPACE_IGNORE=".pnpm,dist,logs"
SHOW_INTERNAL_CLAW_FILES=false
```

Environment variables:

| Variable                   | Default              | Description                                                                 |
| -------------------------- | -------------------- | --------------------------------------------------------------------------- |
| `CLAWSPACE_ROOT`           | `..` (parent of cwd) | Workspace root directory to browse/edit                                     |
| `CLAWSPACE_IGNORE`         | _(empty)_            | Comma-separated extra ignore patterns (e.g. `".pnpm,dist,logs"`)            |
| `SHOW_INTERNAL_CLAW_FILES` | `false`              | Set to `true` to show internal files (`SOUL.md`, `MEMORY.md`, `.env`, etc.) |

Internal files are blocked at the root level unless `SHOW_INTERNAL_CLAW_FILES=true`:

- SOUL.md, AGENTS.md, IDENTITY.md, USER.md, NICK.md
- MEMORY.md, HEARTBEAT.md, TOOLS.md, BOOTSTRAP.md
- .env

Ignore patterns are merged from:

1. Hardcoded defaults (`.git`, `node_modules`, `.pnpm`, `.cache`, `.DS_Store`, `.astro`, `workspace-astro`, `.pi`)
2. `.gitignore` at workspace root
3. `.clawspace-ignore` at workspace root
4. `CLAWSPACE_IGNORE` (comma-separated patterns)

## Replacing the Old Server

To use this instead of the old Node.js server:

1. Update `scripts/serve.sh`:

   ```bash
   #!/bin/bash
   cd /claw/workspace/workspace-astro
   PORT=${1:-6789} npm run dev -- --port $PORT
   ```

2. Or just run directly:
   ```bash
   cd workspace-astro && ./start.sh
   ```

## Development

Files are watched and hot-reloaded automatically in dev mode. The UI updates instantly when you make changes.

> **Note:** Whenever we make changes to Clawspace, rebuild and restart Clawspace so updates are reflected in the running server.
