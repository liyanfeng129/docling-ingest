# Docling Ingest

A web application for PDF document ingestion with interactive preview, content editing, and vector database storage. Built on [Docling](https://github.com/DS4SD/docling) for PDF parsing and [ChromaDB](https://www.trychroma.com/) for vector storage.

## Features

- **PDF Upload & Conversion** — Upload PDFs, automatically extract text, tables, and images using Docling
- **Interactive Content Viewer** — Preview extracted content page-by-page with visual annotations
- **Content Editing** — Delete, reorder, and edit items before ingestion. Full undo/redo support
- **Image Classification** — Classify images (logo, chart, diagram, photo, etc.) with customizable presets
- **AI Image Descriptions** — Optional vision model integration to auto-generate image alt-text
- **Embedding Preview** — Preview how documents will be chunked before ingestion
- **Vector DB Ingestion** — Ingest processed documents into ChromaDB collections
- **Multiple Strategies** — Choose between per-page, chunked, or custom ingestion strategies
- **Dark Mode** — Automatic theme detection based on system preferences
- **Offline-First** — Document state is managed in the browser via localStorage

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────────┐
│   Frontend   │────▶│    Proxy     │────▶│     Engine       │
│  React/Vite  │     │   Node.js   │     │  Python/FastAPI  │
│   :3000      │     │   :4006     │     │   :8000          │
└─────────────┘     └─────────────┘     └─────────────────┘
                                              │
                                         ┌────┴────┐
                                         │ChromaDB │
                                         │(embedded)│
                                         └─────────┘
```

- **Frontend** — React + Vite + Tailwind CSS. Single-page app with the ingestion interface
- **Proxy** — Node.js/Express. Aggregates local and remote config, proxies requests to the engine
- **Engine** — Python/FastAPI. Runs Docling for PDF conversion, manages embeddings and ChromaDB

## Quick Start

### Docker Compose (Recommended)

```bash
git clone https://github.com/liyanfeng129/docling-ingest.git
cd docling-ingest
docker compose up --build
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### With Vision Model (Optional)

To enable AI-powered image descriptions:

```bash
docker compose --profile vision up --build
```

Then pull the vision model:

```bash
docker exec -it docling-ingest-ollama-1 ollama pull granite3.2-vision:2b
```

And set `ENABLE_VISION_MODEL=true` in the engine environment.

### Manual Setup

**Engine (Python):**

```bash
cd backend/engine
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

**Proxy (Node.js):**

```bash
cd backend/proxy
npm install
PORT=4006 ENGINE_URL=http://localhost:8000 node index.js
```

**Frontend:**

```bash
cd frontend
npm install
npm run dev
```

## Configuration

### Environment Variables

| Variable | Service | Default | Description |
|----------|---------|---------|-------------|
| `VITE_INGESTION_URL` | Frontend | `http://localhost:4006` | Proxy service URL |
| `PORT` | Proxy | `4006` | Proxy listen port |
| `ENGINE_URL` | Proxy | `http://localhost:8000` | Engine service URL |
| `ENABLE_VISION_MODEL` | Engine | `false` | Enable Ollama vision model |
| `EMBEDDING_MODEL` | Engine | `Snowflake/snowflake-arctic-embed-l` | Sentence Transformers model |
| `CHROMA_PERSIST_DIRECTORY` | Engine | `./resources/chroma_db/default` | ChromaDB storage path |
| `CHROMA_COLLECTION_NAME` | Engine | `documents` | Default collection name |
| `OLLAMA_BASE_URL` | Engine | `http://localhost:11434` | Ollama server URL |
| `VISION_MODEL` | Engine | `granite3.2-vision:2b` | Ollama vision model name |

## Persistent Data & Docker Volumes

When running with Docker Compose, any files created by the app at runtime (such as the ChromaDB vector database) are stored in **named Docker volumes**, not on your local filesystem directly.

### Where is the Vector DB?

When you ingest a document, ChromaDB writes its data to the `chroma_data` volume, mapped to `/app/resources/chroma_db` inside the engine container.

**To browse the data in Docker Desktop:**

1. Open **Docker Desktop**
2. Click **Volumes** in the left sidebar
3. Click **`docling-ingest_chroma_data`**
4. Click the **Data** tab to browse the files

The ChromaDB collection files will be under the `default/` folder.

**To inspect via terminal:**

```bash
# List files inside the volume
docker exec -it docling-ingest-engine-1 ls /app/resources/chroma_db/default

# Copy the entire database to your local machine
docker cp docling-ingest-engine-1:/app/resources/chroma_db ./chroma_db_backup
```

**To use a local folder instead of a Docker volume** (so data appears directly in your project), replace the volume in `docker-compose.yml`:

```yaml
volumes:
  - ./chroma_db:/app/resources/chroma_db   # bind mount — visible in Finder/Explorer
```

> **Note:** The `chroma_data` volume persists across container restarts and rebuilds. To fully delete it run `docker volume rm docling-ingest_chroma_data`.

## License

[MIT](LICENSE)
