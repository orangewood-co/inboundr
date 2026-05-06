# React + TypeScript + Vite + shadcn/ui

This package is the BTSA frontend app in the root Bun workspace monorepo.

Install dependencies from the repository root:

```bash
bun install
```

Run the frontend from the repository root:

```bash
bun run dev:frontend
```

Run frontend-only commands from this package directory:

```bash
bun run dev
bun run build
bun run typecheck
```

## Adding components

To add components to your app, run the following command:

```bash
npx shadcn@latest add button
```

This will place the ui components in the `src/components` directory.

## Using components

To use the components in your app, import them as follows:

```tsx
import { Button } from "@/components/ui/button"
```
