# Technical Requirements - Query Testing Page

## Functional Requirements

### FR-1: Page Navigation (US-1)

| ID | Requirement | Source |
|----|-------------|--------|
| FR-1.1 | The app SHALL render a top navigation bar on all pages | US-1 |
| FR-1.2 | The navigation bar SHALL contain tabs for "Ingestion" and "Query Testing" | US-1 |
| FR-1.3 | Clicking a tab SHALL switch the displayed page without full page reload | US-1 |
| FR-1.4 | The active tab SHALL be visually distinguished (e.g., underline, color) | US-1 |
| FR-1.5 | Page state SHALL be preserved when switching between tabs (React component state maintained via conditional rendering, not unmounting) | US-1 |

### FR-2: Collection Selection (US-2)

| ID | Requirement | Source |
|----|-------------|--------|
| FR-2.1 | The system SHALL provide a GET endpoint to list all collections with document counts | US-2 |
| FR-2.2 | The UI SHALL render a dropdown selector populated with available collections | US-2 |
| FR-2.3 | Each collection option SHALL display its name and document count | US-2 |
| FR-2.4 | The UI SHALL display a message when no collections are available | US-2 |
| FR-2.5 | Selecting a collection SHALL update the search target without triggering a search | US-2 |
| FR-2.6 | The system SHALL provide a GET endpoint for collection details (doc count, metadata keys sample) | US-2 |

### FR-3: Similarity Search (US-3, US-4)

| ID | Requirement | Source |
|----|-------------|--------|
| FR-3.1 | The system SHALL provide a POST `/api/retrieval/search` endpoint accepting `{query, collectionId, k, enableReranking, rerankK}` | US-3 |
| FR-3.2 | The endpoint SHALL embed the query using the loaded embedding model | US-3 |
| FR-3.3 | The endpoint SHALL perform cosine similarity search on the specified collection | US-3 |
| FR-3.4 | The endpoint SHALL return results as `{content, metadata, distance}` ordered by distance ascending | US-3, US-4 |
| FR-3.5 | The endpoint SHALL NOT mutate the vectorstore singleton's default collection state (use read-only collection access) | US-3 |
| FR-3.6 | The UI SHALL provide a textarea for query input | US-3 |
| FR-3.7 | The UI SHALL trigger search via button click or Ctrl+Enter | US-3 |
| FR-3.8 | The UI SHALL show a loading spinner during search execution | US-3 |
| FR-3.9 | The UI SHALL render results in ranked cards showing content and distance score | US-3, US-4 |
| FR-3.10 | The UI SHALL display "no results" when search returns empty | US-3 |
| FR-3.11 | The UI SHALL display error messages on search failure | US-3 |

### FR-4: Metadata Display (US-5, US-9)

| ID | Requirement | Source |
|----|-------------|--------|
| FR-4.1 | Each result card SHALL render all metadata key-value pairs | US-5 |
| FR-4.2 | The `source` metadata SHALL render as a filename badge | US-5 |
| FR-4.3 | The `page_number` / `page_range` metadata SHALL render as a page badge | US-5 |
| FR-4.4 | The `images` metadata (JSON-encoded list) SHALL be parsed and rendered as thumbnails | US-5 |
| FR-4.5 | The `strategy` metadata SHALL render as a labeled tag | US-5 |
| FR-4.6 | Unknown metadata keys SHALL render as generic key-value pairs | US-5 |
| FR-4.7 | Result content exceeding 300 characters SHALL be truncated with an expand/collapse toggle | US-9 |

### FR-5: Search Parameters (US-6)

| ID | Requirement | Source |
|----|-------------|--------|
| FR-5.1 | The UI SHALL provide a number input for k (results count) | US-6 |
| FR-5.2 | k SHALL default to 8, with min=1 and max=50 | US-6 |
| FR-5.3 | The backend SHALL validate k is within [1, 50] | US-6 |
| FR-5.4 | Parameter values SHALL persist within the session (not across refreshes) | US-6 |
| FR-5.5 | The parameter panel SHALL use a config-driven `PARAM_DEFINITIONS` array for extensibility | US-6 |

### FR-6: Reranking (US-7, US-11)

| ID | Requirement | Source |
|----|-------------|--------|
| FR-6.1 | The UI SHALL provide a toggle to enable/disable reranking | US-7 |
| FR-6.2 | When reranking is enabled, the UI SHALL show a rerank_k input (default=3, min=1, max=20) | US-7 |
| FR-6.3 | When reranking is disabled, the rerank_k input SHALL be hidden | US-7 |
| FR-6.4 | The backend SHALL implement a `RerankerManager` singleton using sentence-transformers CrossEncoder | US-7 |
| FR-6.5 | The reranker SHALL load lazily on first rerank request (not at startup) | US-7 |
| FR-6.6 | Reranked results SHALL include both `distance` (from vector search) and `rerankScore` (from CrossEncoder) | US-7 |
| FR-6.7 | Reranked results SHALL be ordered by rerank score descending (highest = most relevant) | US-7 |
| FR-6.8 | The reranker model SHALL be configurable via `RERANKER_MODEL` environment variable | US-11 |
| FR-6.9 | Available reranker models SHALL be listed in `ingestion_config.json` | US-11 |
| FR-6.10 | The reranker model name SHALL be visible in the observability panel | US-11 |

### FR-7: Observability (US-8)

| ID | Requirement | Source |
|----|-------------|--------|
| FR-7.1 | The search response SHALL include timing breakdown: `{embeddingMs, searchMs, rerankMs, totalMs}` | US-8 |
| FR-7.2 | The search response SHALL include observability data: `{embeddingModel, embeddingDim, collectionDocCount, queryLength}` | US-8 |
| FR-7.3 | The UI SHALL render a dedicated observability panel showing timing and metadata | US-8 |
| FR-7.4 | The observability panel SHALL update with each new search | US-8 |
| FR-7.5 | When reranking is enabled, the reranker model name SHALL be included in observability | US-8, US-11 |

### FR-8: Search History (US-10)

| ID | Requirement | Source |
|----|-------------|--------|
| FR-8.1 | The system SHALL maintain an in-memory list of recent searches (max 20) | US-10 |
| FR-8.2 | Each history entry SHALL contain: query, params, result count, total time | US-10 |
| FR-8.3 | Clicking a history entry SHALL populate the query and params and re-execute | US-10 |
| FR-8.4 | History SHALL be cleared on page refresh | US-10 |

---

## Non-Functional Requirements

### NFR-1: Performance

| ID | Requirement |
|----|-------------|
| NFR-1.1 | Similarity search (without reranking) SHALL complete within 2 seconds for collections up to 10,000 documents |
| NFR-1.2 | The reranker model SHALL load in under 30 seconds on first use |
| NFR-1.3 | The reranker SHALL NOT block server startup (lazy loading) |
| NFR-1.4 | The UI SHALL remain responsive during search execution (non-blocking) |

### NFR-2: Extensibility

| ID | Requirement |
|----|-------------|
| NFR-2.1 | New search parameters SHALL be addable by extending `PARAM_DEFINITIONS` array without code changes to rendering logic |
| NFR-2.2 | New metadata types SHALL be addable by extending the metadata renderer registry |
| NFR-2.3 | New reranker models SHALL be addable via config without code changes |
| NFR-2.4 | The retrieval domain SHALL be fully separated from the ingestion domain (separate routes, controllers, services) |

### NFR-3: Modularity & Separation of Concerns

| ID | Requirement |
|----|-------------|
| NFR-3.1 | Backend retrieval logic SHALL live in dedicated files (`retrieval_routes.py`, `retrieval_controller.py`) separate from ingestion |
| NFR-3.2 | The reranker SHALL be a standalone model manager, independent from the embedding manager |
| NFR-3.3 | Frontend retrieval components SHALL live in a dedicated `components/retrieval/` directory |
| NFR-3.4 | The query testing page SHALL use its own hook (`useQueryTesting`) with no dependency on ingestion context |
| NFR-3.5 | The proxy SHALL have separate retrieval service/controller/routes files |

### NFR-4: Observability

| ID | Requirement |
|----|-------------|
| NFR-4.1 | All backend retrieval operations SHALL be logged with timing information |
| NFR-4.2 | The search endpoint SHALL return structured timing data for every response |
| NFR-4.3 | Errors SHALL be logged with full stack traces on the backend |
| NFR-4.4 | The reranker model loading event SHALL be logged clearly |

### NFR-5: Thread Safety

| ID | Requirement |
|----|-------------|
| NFR-5.1 | The `search_with_scores` method SHALL NOT mutate `_default_collection` on the vectorstore singleton |
| NFR-5.2 | Collection access for retrieval SHALL use read-only temporary clients to avoid race conditions with ingestion operations |

---

## API Contract

### POST /api/retrieval/search

**Request:**
```json
{
  "query": "string (required)",
  "collectionId": "string (required)",
  "k": "integer (default: 8, min: 1, max: 50)",
  "enableReranking": "boolean (default: false)",
  "rerankK": "integer (default: 3, min: 1, max: 20)"
}
```

**Response (success):**
```json
{
  "success": true,
  "results": [
    {
      "content": "string",
      "metadata": { "source": "...", "page_number": 1, "images": "[...]", ... },
      "distance": 0.234,
      "rerankScore": 0.89
    }
  ],
  "timing": {
    "embeddingMs": 45,
    "searchMs": 12,
    "rerankMs": 150,
    "totalMs": 207
  },
  "observability": {
    "embeddingModel": "Snowflake/snowflake-arctic-embed-l-v2.0",
    "embeddingDim": 1024,
    "collectionDocCount": 156,
    "queryLength": 42,
    "rerankerModel": "cross-encoder/ms-marco-MiniLM-L-6-v2"
  }
}
```

**Response (error):**
```json
{
  "success": false,
  "error": "Collection 'xyz' not found"
}
```

### GET /api/retrieval/collections

**Response:**
```json
{
  "success": true,
  "collections": [
    { "id": "default", "label": "Default", "type": "chroma", "docCount": 156, "isDefault": true },
    { "id": "my_docs", "label": "My Docs", "type": "chroma", "docCount": 42, "isDefault": false }
  ]
}
```

### GET /api/retrieval/collection/{collection_id}/info

**Response:**
```json
{
  "success": true,
  "collection": {
    "id": "default",
    "docCount": 156,
    "metadataKeys": ["source", "page_number", "strategy", "images", "chunk_index"],
    "sampleMetadata": { "source": "report.pdf", "page_number": 3, "strategy": "embed_per_page" }
  }
}
```
