# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

OPC Shipping Backend — a Vercel serverless API backend (Node.js/JavaScript) for Oregon Prep Center, a 3PL/Amazon FBA prep business. Nine API endpoint files live in `api/`. No frontend code is in this repo.

### Running locally

Start the dev server with:

```
npx vercel dev --local --yes --listen 0.0.0.0:3000
```

This runs all `api/*.js` files as serverless functions without needing a Vercel account or project link. The `--local` flag skips Vercel project linking.

### Key endpoints for smoke testing

- `GET /api` — health check, always returns `{"message":"OPC Backend is live 🚀"}` (no env vars needed)
- `GET /api/testdb` — stub that returns `{"message":"test-db works"}` (no env vars needed)

### Environment variables

Most endpoints require `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`. Email endpoints require `SENDGRID_API_KEY`. The `claude-proxy` endpoint requires `ANTHROPIC_API_KEY`. Set `IS_DEV=true` in `.env.local` to skip sending real emails in dev mode. Without these keys, endpoints return descriptive error messages but the server itself runs fine.

### Gotchas

- There is no lockfile (`package-lock.json`) committed to the repo; `npm install` resolves versions from `package.json` ranges each time.
- There are no automated tests in this repo.
- There is no linter configured.
- There is no build step — Vercel deploys the `api/` directory directly.
