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

| Variable                   | Default              | Description                                                                 |
| -------------------------- | -------------------- | --------------------------------------------------------------------------- |
| `CLAWSPACE_ROOT`           | `..` (parent of cwd) | Workspace root directory to browse/edit                                     |
| `CLAWSPACE_IGNORE`         | _(empty)_            | Comma-separated extra ignore patterns (e.g. `".pnpm,dist,logs"`)            |
| `SHOW_INTERNAL_CLAW_FILES` | `false`              | Set to `true` to show internal files (`SOUL.md`, `MEMORY.md`, `.env`, etc.) |

## Ignore Patterns

Files and directories are hidden from browsing and blocked from the save API using patterns from (all merged):

1. **Hardcoded defaults** — `.git`, `node_modules`, `.pnpm`, `.cache`, `.DS_Store`, `.astro`, `workspace-astro`, `.pi`
2. **`.gitignore`** at workspace root
3. **`.clawspace-ignore`** at workspace root — same format as `.gitignore`, for user-specific patterns
4. **`CLAWSPACE_IGNORE`** env var — comma-separated patterns

For Docker users without a `.gitignore`, the defaults cover common cases. Add a `.clawspace-ignore` file to the mounted workspace volume or set `CLAWSPACE_IGNORE` for additional patterns.

## Implementation Rules

1. **Never weaken path safety** in save API (no traversal/symlink escapes).
2. **Do not expose internal files** (`SOUL.md`, `MEMORY.md`, `.env`, etc.) unless `SHOW_INTERNAL_CLAW_FILES=true`.
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

<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, but it invokes Vite through `vp dev` and `vp build`.

## Vite+ Workflow

`vp` is a global binary that handles the full development lifecycle. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

### Start

- create - Create a new project from a template
- migrate - Migrate an existing project to Vite+
- config - Configure hooks and agent integration
- staged - Run linters on staged files
- install (`i`) - Install dependencies
- env - Manage Node.js versions

### Develop

- dev - Run the development server
- check - Run format, lint, and TypeScript type checks
- lint - Lint code
- fmt - Format code
- test - Run tests

### Execute

- run - Run monorepo tasks
- exec - Execute a command from local `node_modules/.bin`
- dlx - Execute a package binary without installing it as a dependency
- cache - Manage the task cache

### Build

- build - Build for production
- pack - Build libraries
- preview - Preview production build

### Manage Dependencies

Vite+ automatically detects and wraps the underlying package manager such as pnpm, npm, or Yarn through the `packageManager` field in `package.json` or package manager-specific lockfiles.

- add - Add packages to dependencies
- remove (`rm`, `un`, `uninstall`) - Remove packages from dependencies
- update (`up`) - Update packages to latest versions
- dedupe - Deduplicate dependencies
- outdated - Check for outdated packages
- list (`ls`) - List installed packages
- why (`explain`) - Show why a package is installed
- info (`view`, `show`) - View package information from the registry
- link (`ln`) / unlink - Manage local package links
- pm - Forward a command to the package manager

### Maintain

- upgrade - Update `vp` itself to the latest version

These commands map to their corresponding tools. For example, `vp dev --port 3000` runs Vite's dev server and works the same as Vite. `vp test` runs JavaScript tests through the bundled Vitest. The version of all tools can be checked using `vp --version`. This is useful when researching documentation, features, and bugs.

## Common Pitfalls

- **Using the package manager directly:** Do not use pnpm, npm, or Yarn directly. Vite+ can handle all package manager operations.
- **Always use Vite commands to run tools:** Don't attempt to run `vp vitest` or `vp oxlint`. They do not exist. Use `vp test` and `vp lint` instead.
- **Running scripts:** Vite+ built-in commands (`vp dev`, `vp build`, `vp test`, etc.) always run the Vite+ built-in tool, not any `package.json` script of the same name. To run a custom script that shares a name with a built-in command, use `vp run <script>`. For example, if you have a custom `dev` script that runs multiple services concurrently, run it with `vp run dev`, not `vp dev` (which always starts Vite's dev server).
- **Do not install Vitest, Oxlint, Oxfmt, or tsdown directly:** Vite+ wraps these tools. They must not be installed directly. You cannot upgrade these tools by installing their latest versions. Always use Vite+ commands.
- **Use Vite+ wrappers for one-off binaries:** Use `vp dlx` instead of package-manager-specific `dlx`/`npx` commands.
- **Import JavaScript modules from `vite-plus`:** Instead of importing from `vite` or `vitest`, all modules should be imported from the project's `vite-plus` dependency. For example, `import { defineConfig } from 'vite-plus';` or `import { expect, test, vi } from 'vite-plus/test';`. You must not install `vitest` to import test utilities.
- **Type-Aware Linting:** There is no need to install `oxlint-tsgolint`, `vp lint --type-aware` works out of the box.

## CI Integration

For GitHub Actions, consider using [`voidzero-dev/setup-vp`](https://github.com/voidzero-dev/setup-vp) to replace separate `actions/setup-node`, package-manager setup, cache, and install steps with a single action.

```yaml
- uses: voidzero-dev/setup-vp@v1
  with:
    cache: true
- run: vp check
- run: vp test
```

## Review Checklist for Agents

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to validate changes.
<!--VITE PLUS END-->
