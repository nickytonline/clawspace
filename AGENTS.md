# AGENTS.md - Clawspace Repository Guidelines

## Scope

This repo is Clawspace (workspace browser/editor), not Nick's personal site docs.

## Goals

- Keep browsing/editing fast and reliable
- Keep write-path security conservative by default
- Preserve easy local customization for users

## Key Paths

- `src/pages/[...path].astro` - file/directory browsing route
- `src/components/CodeViewer.astro` - Monaco editor UI + client behavior
- `src/pages/api/files/save.ts` - file save API (hardening/audit)
- `src/layouts/WorkspaceLayout.astro` - shell layout and nav
- `src/lib/ignore.ts` - shared ignore-pattern logic (defaults, .gitignore, .clawspace-ignore, env vars)
- `scripts/serve.sh` - production SSR server helper

## Commands

```bash
npm install
npm run dev
npm run build
npm run clawspace:serve
```

## Git

- Always use [Conventional Commits](https://www.conventionalcommits.org/) (e.g. `fix:`, `feat:`, `chore:`, `docs:`, `refactor:`).

## Environment Variables

| Variable           | Default              | Description                                                      |
| ------------------ | -------------------- | ---------------------------------------------------------------- |
| `CLAWSPACE_ROOT`   | `..` (parent of cwd) | Workspace root directory to browse/edit                          |
| `CLAWSPACE_IGNORE` | _(empty)_            | Comma-separated extra ignore patterns (e.g. `".pnpm,dist,logs"`) |

## Ignore Patterns

Files and directories are hidden from browsing and blocked from the save API using patterns from (all merged):

1. **Hardcoded defaults** — `.git`, `node_modules`, `.pnpm`, `.cache`, `.DS_Store`, `.astro`, `workspace-astro`, `.pi`
2. **`.gitignore`** at workspace root
3. **`.clawspace-ignore`** at workspace root — same format as `.gitignore`, for user-specific patterns
4. **`CLAWSPACE_IGNORE`** env var — comma-separated patterns

For Docker users without a `.gitignore`, the defaults cover common cases. Add a `.clawspace-ignore` file to the mounted workspace volume or set `CLAWSPACE_IGNORE` for additional patterns.

## Implementation Rules

1. **Never weaken path safety** in save API (no traversal/symlink escapes).
2. **Do not expose internal files** (`SOUL.md`, `MEMORY.md`, `.env`, etc.).
3. Keep editor UX simple: always-on Monaco, Save/Revert/Copy.
4. Prefer inline Monaco markers for errors over alert spam.
5. Keep workspace-root mapping assumptions explicit in docs.
6. Support `CLAWSPACE_ROOT` for nonstandard install paths (documented).

## OpenClaw Startup

OpenClaw can start Clawspace via:

```bash
bash /claw/workspace/scripts/serve.sh 6789 &
```

(Wrapper delegates to this repo's `scripts/serve.sh`.)
