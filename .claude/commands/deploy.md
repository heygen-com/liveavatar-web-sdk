---
description: Deploy a staging (develop) o production (master)
argument-hint: [staging|production]
allowed-tools: Bash(pnpm:*), Bash(git:*), Bash(vercel:*)
---

# Deploy Clara Voice Agent

## Objetivo

Deploy seguro a $ARGUMENTS (staging o production)

## Pre-checks obligatorios

1. Verificar branch actual:

```bash
git branch --show-current
```

2. Verificar cambios sin commit:

```bash
git status --short
```

3. Verificar que build pasa:

```bash
pnpm build
```

## Lógica de Deploy

### Si $ARGUMENTS = "staging" o "develop":

- Branch requerido: `develop`
- URL destino: https://testers.betaskintech.com
- Comando: `vercel` (preview)

### Si $ARGUMENTS = "production" o "master":

- Branch requerido: `master`
- URL destino: https://clara.betaskintech.com
- Comando: `vercel --prod`
- REQUIERE: PR aprobado de develop → master

## Post-deploy

1. Verificar que el deploy fue exitoso
2. Mostrar URL de deploy
3. Recordar testear en browser real (Chrome + mobile)

## Warnings

- NO hacer deploy a production desde develop directamente
- SIEMPRE testear en staging primero
- En production, verificar que el PR fue aprobado
