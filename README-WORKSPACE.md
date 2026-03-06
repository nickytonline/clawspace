# Workspace File Server (Astro)

This is Nick's personal site converted into a workspace file browser. It serves files from `/claw/workspace` with the look and feel of nickyt.co.

## Features

- ✨ Beautiful UI with dark mode support
- 📁 Directory browsing with icons
- 🔒 Respects .gitignore patterns
- 🚫 Blocks internal files (SOUL.md, AGENTS.md, etc.)
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

The workspace root is set to `/claw/workspace` (parent of this directory). Files and folders are served dynamically from there.

Internal files (never served):

- SOUL.md, AGENTS.md, IDENTITY.md, USER.md, NICK.md
- MEMORY.md, HEARTBEAT.md, TOOLS.md, BOOTSTRAP.md
- .env

Also ignores:

- Everything in .gitignore
- .git directory
- workspace-astro directory (this folder itself)

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
