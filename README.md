# Smart POS — Multi-tenant POS SaaS

Cloud-based Point of Sale platform for small-medium businesses, with an AI agent
that answers natural-language business questions via Claude function calling.

Full plan: [docs/smart-pos-project-plan.md](docs/smart-pos-project-plan.md)

## Structure

```
smart-pos/
├── frontend/   # Next.js 15 + TypeScript + Tailwind + shadcn/ui
├── backend/    # Express + TypeScript + Prisma + PostgreSQL
└── docs/       # Project plan and notes
```

## Getting started

### Backend

```bash
cd backend
npm install
cp .env.example .env        # fill in DATABASE_URL, JWT secrets, ANTHROPIC_API_KEY
npm run prisma:migrate      # create DB tables
npm run dev                 # http://localhost:5000
```

### Frontend

```bash
cd frontend
npm install
npm run dev                 # http://localhost:3000
```

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, Recharts |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL + Prisma |
| Auth | JWT (15min access + 7day refresh rotation), bcrypt |
| AI | Claude API with tool use |
