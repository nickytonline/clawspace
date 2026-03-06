# Clawspace

![Nano banana lobster at a desk](./public/assets/nano-banana-lobster.png)

Clawspace is a browser-based file explorer/editor for an OpenClaw workspace.

It gives you:

- File and directory browsing
- Monaco editor for text files
- Save/revert/copy actions
- Auto-format on blur (supported file types)
- Basic hardening for writes (path checks, blocked files, audit log)

## Why this exists

OpenClaw users often want a fast, authenticated UI to inspect and edit workspace files without opening SSH/terminal sessions.

Clawspace is designed to run on your LAN, or behind a trusted auth proxy (for example Pomerium + OpenClaw trusted-proxy mode).

## Install

```bash
git clone https://github.com/nickytonline/clawspace
cd clawspace
npm install
```

## Quick start

```bash
npm run build
npm run clawspace:serve
```

Default port is `6789`.

## Development

```bash
npm run dev
```

## Configuration

Clawspace uses the parent of the app directory as the workspace root by default.
If you install it elsewhere, set `CLAWSPACE_ROOT` to an absolute path.

```bash
# .env (see .env.example)
CLAWSPACE_ROOT=/absolute/path/to/workspace
CLAWSPACE_IGNORE=".pnpm,dist,logs"
SHOW_INTERNAL_CLAW_FILES=false
```

### Environment variables

| Variable                   | Default              | Description                                                                 |
| -------------------------- | -------------------- | --------------------------------------------------------------------------- |
| `CLAWSPACE_ROOT`           | `..` (parent of cwd) | Workspace root directory to browse/edit                                     |
| `CLAWSPACE_IGNORE`         | _(empty)_            | Comma-separated extra ignore patterns (e.g. `".pnpm,dist,logs"`)            |
| `SHOW_INTERNAL_CLAW_FILES` | `false`              | Set to `true` to show internal files (`SOUL.md`, `MEMORY.md`, `.env`, etc.) |

### Ignore patterns

Files and directories are hidden from browsing and blocked from the save API using patterns from (all merged):

1. **Hardcoded defaults**: `.git`, `node_modules`, `.pnpm`, `.cache`, `.DS_Store`, `.astro`, `workspace-astro`, `.pi`
2. **`.gitignore`** at workspace root
3. **`.clawspace-ignore`** at workspace root (same format as `.gitignore`)
4. **`CLAWSPACE_IGNORE`** env var (comma-separated patterns)

## Scripts

- `npm run build` → runs SSR build (`dist/server/entry.mjs`)
- `npm run clawspace:serve` → serves production SSR build on port 6789
- `./scripts/serve.sh [port]` → serve on optional port

## OpenClaw integration

If you want OpenClaw to start Clawspace in your workspace session, use the root wrapper script:

```bash
bash /claw/workspace/scripts/serve.sh 6789 &
```

That wrapper delegates to `workspace-astro/scripts/serve.sh`.

## Running in a separate container

You can also run Clawspace in its own container and mount the same workspace volume:

```yaml
clawspace:
  image: ghcr.io/nickytonline/clawspace:latest
  environment:
    CLAWSPACE_ROOT: /claw/workspace
    CLAWSPACE_IGNORE: ".pnpm,dist,logs"
    SHOW_INTERNAL_CLAW_FILES: "false"
  volumes:
    - ./openclaw-data/workspace:/claw/workspace
  ports:
    - "6789:6789"
```

The key is sharing the workspace volume. If the workspace is mounted elsewhere, set `CLAWSPACE_ROOT` accordingly.

Note: I keep Clawspace inside my workspace while I’m still iterating on it with OpenClaw.

## Docker

```bash
docker build -t clawspace:local .
docker run -p 6789:6789 \
  -e CLAWSPACE_ROOT=/claw/workspace \
  -e CLAWSPACE_IGNORE=".pnpm,dist,logs" \
  -e SHOW_INTERNAL_CLAW_FILES=false \
  -v $(pwd)/openclaw-data/workspace:/claw/workspace \
  clawspace:local
```

## Security notes

- Assume network-level auth is handled externally (LAN/private network or trusted proxy)
- Recommended: OpenClaw trusted-proxy auth mode: https://docs.openclaw.ai/gateway/trusted-proxy-auth
- Single-user assumption: no roles/admin checks, just your OpenClaw workspace
- File writes are restricted to workspace root and blocked for internal/sensitive files
- Writes are audited to: `/claw/workspace/logs/clawspace-edit-audit.log`

## Customization

Clawspace is intentionally tweakable. Clone it, edit UI/guardrails, and make it yours.

## Credits

- README image generated with Google Gemini (Nano Banana model).
