# Mizan — ميزان

**A fully local, privacy-first AI legal assistant for Saudi Arabian law.**

Mizan is a free, open-source desktop application for licensed Saudi attorneys. All AI inference runs on your machine via [Ollama](https://ollama.com). Your documents, queries, and client matters never leave your device. Zero bytes sent.

---

## Features

**Attorney Workspace**

| Tool | Description |
|---|---|
| Legal Research | Multi-turn Q&A grounded in ingested Saudi statutes with article-level citations |
| Document Review | Structured analysis of contracts and filings: risks, missing clauses, favorability score |
| Draft Generator | Saudi-compliant document drafts from structured inputs |
| Contract Redlining | Inline clause-level redline suggestions against Saudi law |
| Legal Translation | Arabic to English and English to Arabic using MOJ-verified terminology |
| Clause Playbook | Standard clause positions for common Saudi contract types |
| Deadline Extractor | Extracts every obligation and notice period from contract text |
| Law Library | Upload your own statutes and sync pre-ingested laws |
| Activity Monitor | Full audit log of sessions, tool usage, and security events |

**Privacy Architecture**

- AI inference runs at `127.0.0.1` via Ollama. No network request is made during inference.
- SQLite database stored locally. No cloud database.
- Vector store (LanceDB) stored locally. No external vector service.
- Lockdown mode: auto-locks after 15 minutes of inactivity, requires email verification to resume.

---

## Requirements

- **macOS** (arm64 or x64), Windows, or Linux
- [Ollama](https://ollama.com) installed and running
- Node.js 20+
- 8 GB RAM minimum (16 GB recommended for `qwen2.5:7b`)

---

## Quick Start

### 1. Install Ollama and pull models

```bash
# Install Ollama from https://ollama.com, then:
ollama pull qwen2.5:7b
ollama pull nomic-embed-text
```

### 2. Clone and install dependencies

```bash
git clone https://github.com/ablugg/mizan.git
cd mizan
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Required
DATABASE_URL="file:./prisma/dev.db"

# Optional — defaults shown
OLLAMA_HOST=http://127.0.0.1:11434
OLLAMA_MODEL=qwen2.5:7b
OLLAMA_EMBEDDING_MODEL=nomic-embed-text
VECTOR_DB_PATH=./data/vector-store

# Law sync — set to the GitHub repo hosting law releases
GITHUB_LAWS_REPO=ablugg/mizan-laws
```

### 4. Set up the database

```bash
npm run db:push
```

### 5. Build the pre-ingested law vector store

```bash
npm run build:vectors
```

This ingests the bundled Saudi statutes into LanceDB. Run once. Re-run whenever you update the source files in `data/laws/`.

### 6. Run

**Dev server:**
```bash
npm run dev
```

**Electron desktop app (dev):**
```bash
npm run electron:dev
```

**Production build:**
```bash
npm run electron:build
```

The DMG (macOS) or installer will appear in `dist-electron/`.

---

## Law Library

Attorneys can upload their own statutes directly from the app under **Law Library**. Uploaded files are chunked and embedded locally into a separate `user_chunks` table in LanceDB. They are never touched by law sync operations and persist independently.

### Syncing pre-ingested laws

The Law Library tab includes a **Sync Laws** button. It downloads the latest `legal_chunks.lance.zip` from GitHub Releases on the configured `GITHUB_LAWS_REPO`, replaces the local vector store, and resets the LanceDB connection. No reinstall required.

### Publishing law updates (maintainers only)

If you are running the admin panel (`MIZAN_ADMIN=true`), the admin page includes a **Sync Laws** button that:

1. Rebuilds the vector store from `data/laws/`
2. Zips `legal_chunks.lance`
3. Creates a new GitHub Release and uploads the zip as an asset

Attorneys then sync with one click.

---

## Architecture

```
Electron shell
    │
    └── Next.js app (standalone)
            │
            ├── /attorney/*         Attorney workspace (9 tools)
            │       │
            │       ├── lib/rag.ts              LanceDB vector retrieval
            │       │     ├── legal_chunks      Pre-ingested Saudi statutes
            │       │     └── user_chunks       Attorney-uploaded laws
            │       │
            │       └── lib/claude.ts           Ollama chat + streaming
            │
            ├── /chat/*             General legal chat
            │
            └── /api/*              API routes (all server-side, local only)

All AI inference: Ollama at 127.0.0.1:11434
Database: SQLite via Prisma (local file)
Vector store: LanceDB (local directory)
```

---

## Stack

| Layer | Tech |
|---|---|
| Desktop shell | Electron 34 |
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| AI inference | Ollama (qwen2.5:7b default) |
| Embeddings | nomic-embed-text via Ollama |
| Vector store | LanceDB (local) |
| Database | SQLite via Prisma |
| Styling | Tailwind CSS |

---

## Project Structure

```
app/
  (attorney)/attorney/*    Attorney workspace pages (9 tools)
  (admin)/admin/           Admin panel (MIZAN_ADMIN=true only)
  api/attorney/*           Attorney API routes
  api/admin/*              Admin API routes
  chat/[id]                General chat
components/
  attorney/                Attorney UI components
lib/
  claude.ts                Ollama wrapper, system prompts
  rag.ts                   LanceDB retrieval, addUserLaw, deleteUserLawChunks
  db.ts                    Prisma client
  local-auth.ts            Local session auth
data/
  laws/                    Saudi statute source files (.txt)
  ingestion/               Vector build pipeline
prisma/
  schema.prisma            SQLite schema
electron/                  Electron main process
```

---

## Law Coverage

Pre-ingested statutes:

- Saudi Labour Law (Royal Decree M/51)
- Civil Transactions Law (Royal Decree M/191)
- Criminal Procedure Code (Royal Decree M/39)
- Personal Data Protection Law (PDPL)
- Commercial Court Law (Royal Decree M/93)
- MOJ Legal Dictionary (695 Arabic-English term pairs)

Additional statutes can be added to `data/laws/` and rebuilt with `npm run build:vectors`, or uploaded directly through the Law Library tool in the app.

---

## Contributing

Pull requests are welcome. For significant changes, open an issue first to discuss the approach.

Areas where contributions are particularly useful:

- Additional Saudi statutes and regulations in `data/laws/`
- Windows and Linux packaging and testing
- Arabic UI improvements
- Additional legal tool types

---

## License

MIT. See [LICENSE](./LICENSE).

---

## Support

Mizan is free for Saudi attorneys. If you find it useful, you can support development through [GitHub Sponsors](https://github.com/sponsors/ablugg). Entirely optional.
