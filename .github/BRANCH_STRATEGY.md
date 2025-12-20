# Branch Strategy - Clara Voice Agent

## Branches

| Branch    | Environment | URL                                                                                   | Purpose               |
| --------- | ----------- | ------------------------------------------------------------------------------------- | --------------------- |
| `master`  | Production  | https://clara-beauty.vercel.app                                                       | Stable, client-facing |
| `develop` | Preview     | https://liveavatar-web-sdk-demo-git-develop-tizeiraivan-gmailcoms-projects.vercel.app | Testing & development |

## Workflow

```
feature/* ──┐
hotfix/*  ──┼──> develop ──> PR ──> master
bugfix/*  ──┘
```

### 1. New Features

```bash
git checkout develop
git pull origin develop
git checkout -b feature/my-feature
# ... work ...
git push -u origin feature/my-feature
# Create PR: feature/* -> develop
```

### 2. Bug Fixes

```bash
git checkout develop
git checkout -b bugfix/fix-description
# ... fix ...
git push -u origin bugfix/fix-description
# Create PR: bugfix/* -> develop
```

### 3. Hotfixes (Production emergencies)

```bash
git checkout master
git checkout -b hotfix/critical-fix
# ... fix ...
git push -u origin hotfix/critical-fix
# Create PR: hotfix/* -> master (then merge master into develop)
```

### 4. Release to Production

```bash
# From GitHub: Create PR develop -> master
# Review changes
# Merge PR
# Vercel auto-deploys to clara-beauty.vercel.app
```

## Vercel Configuration

- **Production Branch**: `master`
- **Preview Branches**: All other branches (auto-generated URLs)
- **Build Command**: `pnpm turbo run build --filter=demo...`

## Rules

1. **Never push directly to master** - Always use PRs
2. **develop is the integration branch** - All features merge here first
3. **Test in preview before production** - Verify on Vercel preview URL
4. **Keep develop up-to-date** - Regularly sync with master

## Environment Variables

All environments share the same env vars in Vercel:

- `HEYGEN_API_KEY`
- `ELEVENLABS_API_KEY`
- `ELEVENLABS_AGENT_ID`
- `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`

## Quick Reference

```bash
# Switch to develop
git checkout develop && git pull origin develop

# Create feature branch
git checkout -b feature/name

# Push and create PR
git push -u origin feature/name

# Update develop with master
git checkout develop && git merge master
```
