---
name: vercel-cli-with-tokens
description: Deploy and manage projects on Vercel using token-based authentication. Use when working with Vercel CLI using access tokens rather than interactive login — e.g. "deploy to vercel", "set up vercel", "add environment variables to vercel".
metadata:
  author: vercel
  version: "1.0.0"
---

# Vercel CLI with Tokens

Deploy and manage projects on Vercel using the CLI with token-based authentication. Use this skill when you have a Vercel access token and need to operate without interactive login.

## Authentication

**Never run `vercel login`.** Always use token-based auth via the `--token` flag or `VERCEL_TOKEN` environment variable. This ensures the correct account is used even if another Vercel account is logged in locally.

```bash
vercel <command> --token "$VERCEL_TOKEN"
```

### Scoping to a Team

Use `--scope` to target a specific team. Accepts a **team slug** or **team ID** (`team_...`):

```bash
vercel <command> --token "$VERCEL_TOKEN" --scope <team-slug-or-id>
```

Not required if the project is already linked (`.vercel/project.json` provides the org context) or if `VERCEL_ORG_ID` is set.

### Targeting a Project

Use `--project` to target a specific project **without needing `vercel link`**. Accepts a project **name** or **project ID** (`prj_...`):

```bash
vercel deploy --token "$VERCEL_TOKEN" --scope <team> --project <project-name-or-id>
```

This is the simplest path when you already have a project ID — no `.vercel/` directory needed.

### Environment Variable Alternative

Instead of flags, you can set these environment variables. The CLI recognizes them natively:

| Variable | Purpose | Equivalent flag |
|---|---|---|
| `VERCEL_TOKEN` | Auth token | `--token` |
| `VERCEL_ORG_ID` | Team/org ID | `--scope` |
| `VERCEL_PROJECT_ID` | Project ID | `--project` |

`VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` must be set **together** — setting only one causes an error. When both are set, the CLI skips `.vercel/project.json` entirely.

### Resolution Precedence

**Token:** `--token` flag > `VERCEL_TOKEN` env var > stored auth in config.

**Team/scope:** `--scope` flag > `scope` in `vercel.json` > `currentTeam` in global config > `VERCEL_ORG_ID`.

**Project:** `--project` flag > `VERCEL_PROJECT_ID` env var > `.vercel/project.json` > interactive prompt.

## CLI Setup

```bash
npm install -g vercel
vercel --version
```

Or use `npx` for one-off commands:
```bash
npx vercel <command> --token "$VERCEL_TOKEN"
```

## Deploying a Project

Always deploy as **preview** unless the user explicitly requests production.

### Quick Deploy (have project ID — no linking needed)

When you already have a project ID (e.g., `prj_...`), deploy directly:

```bash
vercel deploy --token "$VERCEL_TOKEN" --scope <team> --project <project-id> -y --no-wait
```

Check status:
```bash
vercel inspect <deployment-url> --token "$VERCEL_TOKEN"
```

Production deploy (only when explicitly requested):
```bash
vercel deploy --prod --token "$VERCEL_TOKEN" --scope <team> --project <project-id> -y --no-wait
```

### Full Deploy Flow (no project ID)

Use this when you have a token and team but need to create or find a project.

#### Step 1: Determine Project State

```bash
# 1. Does the project have a git remote?
git remote get-url origin 2>/dev/null

# 2. Is it already linked to a Vercel project?
cat .vercel/project.json 2>/dev/null || cat .vercel/repo.json 2>/dev/null
```

#### Step 2: Link the Project

If no `.vercel/project.json` or `.vercel/repo.json` exists, link first.

**With git remote (preferred):**
```bash
vercel link --repo --token "$VERCEL_TOKEN" --scope <team> -y
```
Reads the git remote and connects to the matching Vercel project. Creates `.vercel/repo.json`. More reliable than `vercel link` without `--repo`, which matches by directory name.

**Without git remote:**
```bash
vercel link --token "$VERCEL_TOKEN" --scope <team> -y
```
Creates `.vercel/project.json`.

**Link to a specific existing project by name:**
```bash
vercel link --project <project-name> --token "$VERCEL_TOKEN" --scope <team> -y
```

If the project is already linked, check `orgId` in `.vercel/project.json` or `.vercel/repo.json` to verify it matches the intended team. If not, re-link with the correct `--scope`.

#### Step 3: Deploy

**A) Git Push Deploy — has git remote (preferred)**

The best long-term setup. Git pushes trigger automatic Vercel deployments.

1. **Ask the user before pushing.** Never push without explicit approval.
2. Commit and push:
   ```bash
   git add .
   git commit -m "deploy: <description of changes>"
   git push
   ```
3. Vercel builds automatically. Non-production branches get preview deployments; the production branch (usually `main`) gets a production deployment.
4. Retrieve the deployment URL:
   ```bash
   sleep 5
   vercel ls --format json --token "$VERCEL_TOKEN" --scope <team>
   ```
   The latest entry in the `deployments` array has the preview URL.

**B) CLI Deploy — no git remote**

```bash
vercel deploy --token "$VERCEL_TOKEN" --scope <team> -y --no-wait
```

`--no-wait` returns immediately with the deployment URL. Check status:
```bash
vercel inspect <deployment-url> --token "$VERCEL_TOKEN"
```

### Deploying from a Remote Repository

If the user wants to deploy code from a remote that isn't cloned locally:

1. Clone the repository:
   ```bash
   git clone <repo-url>
   cd <repo-name>
   ```
2. Link to Vercel:
   ```bash
   vercel link --repo --token "$VERCEL_TOKEN" --scope <team> -y
   ```
3. Deploy via git push (if you have push access) or CLI deploy.

### About `.vercel/` Directory

A linked project has either:
- `.vercel/project.json` — from `vercel link`. Contains `projectId` and `orgId`.
- `.vercel/repo.json` — from `vercel link --repo`. Contains `orgId`, `remoteName`, and a `projects` map.

Either file means the project is linked. Not needed when using `--project` flag or `VERCEL_ORG_ID` + `VERCEL_PROJECT_ID` env vars.

**Do NOT** run `vercel project inspect`, `vercel ls`, or `vercel link` in an unlinked directory to detect state — without `.vercel/`, they will interactively prompt or silently link as a side-effect. Only `vercel whoami --token "$VERCEL_TOKEN"` is safe to run anywhere.

## Managing Environment Variables

Run from a linked project directory, or use `--project` to target a specific project.

```bash
# Set for all environments
echo "value" | vercel env add VAR_NAME --token "$VERCEL_TOKEN" --scope <team>

# Set for a specific environment (production, preview, development)
echo "value" | vercel env add VAR_NAME production --token "$VERCEL_TOKEN" --scope <team>

# List environment variables
vercel env ls --token "$VERCEL_TOKEN" --scope <team>

# Pull env vars to local .env file
vercel env pull --token "$VERCEL_TOKEN" --scope <team>

# Remove a variable
vercel env rm VAR_NAME --token "$VERCEL_TOKEN" --scope <team> -y
```

## Inspecting Deployments

```bash
# List recent deployments
vercel ls --format json --token "$VERCEL_TOKEN" --scope <team>

# Inspect a specific deployment
vercel inspect <deployment-url> --token "$VERCEL_TOKEN"

# View build logs
vercel logs <deployment-url> --token "$VERCEL_TOKEN"
```

## Managing Domains

```bash
# List domains
vercel domains ls --token "$VERCEL_TOKEN" --scope <team>

# Add a domain to the project
vercel domains add <domain> --token "$VERCEL_TOKEN" --scope <team>
```

## Working Agreement

- **Always use `--token`** on every Vercel CLI command. Never rely on local login state.
- **Use `--scope` and/or `--project`** to target the correct team and project.
- **Do not run `vercel login`.** Authentication is handled entirely by the access token.
- **Default to preview deployments.** Only deploy to production when explicitly asked.
- **Ask before pushing to git.** Never push commits without the user's approval.
- **Do not read or modify `.vercel/` files directly.** The CLI manages this directory.
- **Do not curl/fetch deployed URLs to verify.** Just return the link to the user.
- **Use `--format json`** when structured output will help with follow-up steps (e.g., `vercel ls`).
- **Use `-y`** on commands that prompt for confirmation to avoid interactive blocking.

## Troubleshooting

### Authentication Error

If commands fail with `Authentication required` or similar:
- The token may be expired or revoked. Ask the user for a fresh token or check the token source.
- Verify the token is valid: `vercel whoami --token "$VERCEL_TOKEN"`

### Wrong Team

If deployments appear under the wrong team, verify `--scope` is correct:
```bash
vercel whoami --token "$VERCEL_TOKEN" --scope <team>
```

### Build Failure

Check the build logs:
```bash
vercel logs <deployment-url> --token "$VERCEL_TOKEN"
```

Common causes:
- Missing dependencies — ensure `package.json` is complete and committed.
- Missing environment variables — add them with `vercel env add`.
- Framework misconfiguration — check `vercel.json` or framework-specific settings.
- Vercel auto-detects frameworks (Next.js, Remix, Vite, etc.) from `package.json`. Override with a `vercel.json` if detection is wrong.

### CLI Not Installed

```bash
npm install -g vercel
```
