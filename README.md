<div align="center">

<img src="https://inboundr.co/logo.png" alt="Inboundr" width="100" height="auto" />

# Inboundr

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

| Technology | Role |
|---|---|
| **Bun** | Runtime & package manager |
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

### Frontend

| Technology | Role |
|---|---|
| **React 19** | UI framework |
| **Vite 7** | Build tool & dev server |
| **TanStack Router** | Type-safe routing |
| **shadcn/ui + Radix UI** | Component library |
| **Tailwind CSS 4** | Styling |

---

## Monorepo Structure

```
inboundr/
├── backend/      # API, AI agents, integrations
├── frontend/     # Dashboard & CRM interface
├── landing/      # Marketing site
└── package.json  # Workspace root
```

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

# Landing page
bun run dev:landing

# Email template preview
bun run email:dev
```

### Quality

```bash
# Typecheck everything
bun run typecheck

# Lint & format the frontend
bun run lint
bun run format
```

### Build

```bash
bun run build
```

---

## Deployment

For the EC2 backend deployment runbook, see [`docs/deployment/ec2-backend.md`](docs/deployment/ec2-backend.md).

---

## License

Proprietary. All rights reserved.
