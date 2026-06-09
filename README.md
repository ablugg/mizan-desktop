# Mizan

Legal AI assistant powered by Claude. Built with privacy-first architecture using Azure Confidential Computing (TEE) and end-to-end encryption.

---

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Auth | Clerk |
| Database | PostgreSQL (Neon/Supabase) + Prisma |
| Vector DB | Pinecone |
| Embeddings | Azure OpenAI (text-embedding-3-small) |
| AI | Anthropic Claude (claude-sonnet-4) |
| TEE | AWS Nitro |
| Styling | Tailwind CSS + Shadcn/ui |

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.local.example .env.local
```

Fill in all values in `.env.local`.

### 3. Set up the database

```bash
npm run db:push
```

### 4. Set up Pinecone index

Create an index called `mizan-legal` in your Pinecone dashboard with:
- Dimensions: 1536 (text-embedding-3-small)
- Metric: cosine

### 5. Run the dev server

```bash
npm run dev
```

---

## Data Ingestion

To populate the vector store with Canadian legal data:

```bash
npm run ingest
```

Edit `data/ingestion/scraper.ts` to add your statute sources. Recommended:
- Justice Laws Canada: laws-lois.justice.gc.ca
- CanLII: canlii.org
- Provincial legislature sites (ON, BC, QC, etc.)

---

## Architecture

```
User Request
    │
    ▼
Clerk Auth (middleware.ts)
    │
    ▼
API Route (app/api/chat/route.ts)
    │
    ├── RAG Retrieval (lib/rag.ts)
    │       └── Pinecone vector search
    │
    ├── Claude API (lib/claude.ts)
    │       └── Streaming response
    │
    └── DB Storage (lib/db.ts)
            └── Prisma → PostgreSQL
```

All inference happens inside Azure Confidential Computing enclave. Conversation data encrypted at rest.

---

## Project Structure

```
app/
  (auth)/login, signup       Auth pages
  (dashboard)/               Protected shell
    chat/[id]                Conversation view
    settings/                User settings
  api/chat                   Claude streaming endpoint
  api/conversations          Chat CRUD
lib/
  claude.ts                  Anthropic SDK wrapper
  rag.ts                     Vector retrieval
  db.ts                      Prisma client
data/ingestion/              Legal data pipeline
prisma/schema.prisma         DB schema
types/index.ts               Shared types
```
