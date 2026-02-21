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
- `scripts/build.sh` - SSR build helper
- `scripts/serve.sh` - production SSR server helper

## Commands

```bash
npm install
npm run dev
npm run clawspace:build
npm run clawspace:serve
```

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
