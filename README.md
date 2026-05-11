# BTSA

Bun workspace monorepo for the BTSA backend service and frontend app.

## Packages

- `backend`: API and automation services.
- `frontend`: Vite React app with TanStack Router and shadcn/ui.

## Setup

Install dependencies from the repository root:

```bash
bun install
```

## Common Commands

Run the backend:

```bash
bun run dev:backend
```

Run the frontend:

```bash
bun run dev:frontend
```

Typecheck both packages:

```bash
bun run typecheck
```

Build the frontend:

```bash
bun run build
```

Lint and format the frontend:

```bash
bun run lint
bun run format
```

## Deployment

For the EC2 backend deployment runbook, see [`docs/deployment/ec2-backend.md`](docs/deployment/ec2-backend.md).
