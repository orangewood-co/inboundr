<img src="https://inboundr.co/banner.png" alt="Inboundr banner" width="100%" />
<div align="center">

### Turn inbound into revenue.

AI that replies to inquiries, generates quotes, follows up, and closes deals — automatically.


[![Built with Bun](https://img.shields.io/badge/runtime-Bun-f9f1e1?logo=bun&logoColor=000)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/lang-TypeScript-3178c6?logo=typescript&logoColor=fff)](https://typescriptlang.org)
[![React 19](https://img.shields.io/badge/ui-React_19-61dafb?logo=react&logoColor=000)](https://react.dev)
[![LangGraph](https://img.shields.io/badge/agents-LangGraph-1c3c3c?logo=langchain&logoColor=fff)](https://langchain-ai.github.io/langgraph/)

</div>

---

## What is Inboundr?

Inboundr automates everything that happens after a customer inquiry — replies, quotes, follow-ups, and conversions. It's your AI sales team that works 24/7 so your human team can focus on what matters.

> **Inbound, handled automatically.**

---

## The Problem

Your team wastes time replying, quoting, and chasing leads. Every hour spent on manual follow-ups is revenue left on the table.

## The Solution

We handle it instantly with AI. Inboundr is an end-to-end AI sales and customer engagement system — everything that happens after a lead comes in.

---

## Features

| | Feature | What it does |
|---|---|---|
| **AI-Powered CRM** | Intelligent contact and deal management that learns from every interaction |
| **Instant Replies** | AI reads inbound leads and responds in seconds, not hours |
| **Quote Generation** | Automatically generates accurate RFQs and quotes from inquiry details |
| **Smart Follow-Ups** | Persistent, context-aware follow-up sequences that don't let deals slip |
| **Lead Calling** | AI calls leads to qualify, nurture, and close |
| **Omnichannel Chat** | Engage prospects on your website and WhatsApp — simultaneously |

---

## Tech Stack

### Backend

| Technology | Role 
|---|---|
| **Bun** | Runtime & package manager 
| **Express 5** | HTTP framework |
| **LangChain / LangGraph** | AI agent orchestration |
| **OpenAI** | LLM provider |
| **Google Vertex AI** | LLM provider |
| **MongoDB + Mongoose** | Document store |
| **PostgreSQL** | Relational data |
| **Better Auth** | Authentication |
| **AWS SES** | Transactional email |
| **React Email** | Email templates |
| **Google PubSub** | Async messaging |

Inboundr requires Bun version v1.3.11 or higher—this is needed for Bun's built-in [cron](https://bun.com/docs/runtime/cron) support.

### Frontend

| Technology | Role |
|---|---|
| **React 19** | UI framework |
| **Vite 7** | Build tool & dev server |
| **TanStack Router** | Type-safe routing |
| **shadcn/ui + Radix UI** | Component library |
| **Tailwind CSS 4** | Styling |

---

## Workspace Guide

```
inboundr/
├── backend/      # API, auth, AI agents, jobs, email, storage, data models
├── frontend/     # Authenticated dashboard and CRM workspace
├── embed/        # Public embeddable forms and short-link experiences
├── landing/      # Public marketing website
└── package.json  # Bun workspace root and shared scripts
```

This repository is a Bun workspace. Install dependencies once at the root, then run each app through the root scripts or from the individual package directories.

| Workspace | What it does | Common commands |
|---|---|---|
| `backend` | Express API for auth, organizations, customers, products, RFQs, invoices, forms, short links, uploads, Gmail, email, scheduled digests, and AI quote/RFQ agents. It owns database models, external integrations, background jobs, and React Email templates. | `bun run dev:backend`, `bun run typecheck:backend`, `bun run email:dev` |
| `frontend` | Main authenticated Inboundr app for CRM workflows: dashboard, customers, products, invoices, RFQs, forms, email, search, settings, links, and organization branding. Built with React, Vite, TanStack Router, shadcn/ui, and Tailwind. | `bun run dev:frontend`, `bun run build:frontend`, `bun run lint:frontend`, `bun run typecheck:frontend` |
| `embed` | Lightweight public-facing React app for embeddable lead capture forms and public short-link pages. It is separate from the dashboard so embedded/customer-facing experiences can stay small and isolated. | `bun run dev:embed`, `bun run build:embed`, `bun run lint:embed`, `bun run typecheck:embed` |
| `landing` | Marketing website with public pages such as home, features, product pages, contact, careers, legal pages, and security. Built with React, Vite, Tailwind, and motion. | `bun run dev:landing`, `bun run build:landing`, `bun run lint:landing`, `bun run typecheck:landing` |

### How the apps fit together

- `backend` is the system of record and integration layer. Start here when changing API behavior, data models, authentication, agents, email templates, jobs, or third-party services.
- `frontend` is the internal product UI. Start here when changing authenticated CRM, quoting, forms management, search, settings, or organization-facing workflows.
- `embed` is for external/public experiences that customers or leads interact with outside the dashboard, such as hosted forms and short-link pages.
- `landing` is for public marketing content and brand pages. Keep product app logic out of this workspace unless it is only presentation for the public site.

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) installed globally

### Install

```bash
bun install
```

### Development

```bash
# API server
bun run dev:backend

# Dashboard
bun run dev:frontend

# Embeddable forms and public links
bun run dev:embed

# Landing page
bun run dev:landing

# Email template preview
bun run email:dev
```

### Quality

```bash
# Typecheck backend and frontend
bun run typecheck

# Typecheck individual workspaces
bun run typecheck:backend
bun run typecheck:frontend
bun run typecheck:embed
bun run typecheck:landing

# Lint frontend apps
bun run lint
bun run lint:frontend
bun run lint:embed
bun run lint:landing

# Format configured frontend apps
bun run format:frontend
bun run format:landing
```

### Build

```bash
# Default production build
bun run build

# Build individual frontend apps
bun run build:frontend
bun run build:embed
bun run build:landing
```

---

## Deployment

For the EC2 backend deployment runbook, see [`docs/deployment/ec2-backend.md`](docs/deployment/ec2-backend.md).

---

## References
- Invoice Design #1 - U.S. Graphics Company Template. [Tweet](https://x.com/usgraphics/status/2054047419755864442) and [source](https://github.com/usgraphics/usgc-invoice).

## License

Proprietary. All rights reserved.
