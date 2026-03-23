# Implementation Plan - Query Testing Page

## Implementation Order

Steps are ordered by dependency chain: backend engine -> proxy -> frontend.

---

### Step 1: Reranker Model (new file)

**Create:** `backend/engine/models/reranker_model.py`

**Implements:** FR-6.4, FR-6.5, FR-6.8, NFR-3.2

- Singleton `RerankerManager` following `embedding_model.py` pattern
- Default: `CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2')` from sentence-transformers
- **Configurable**: Reads model name from `settings.RERANKER_MODEL`
- `rerank(query, documents, top_k) -> List[Document]` -- scores `(query, doc.page_content)` pairs, attaches `rerank_score` to metadata, returns sorted top_k
- `load(model_name=None)` -- loads specified or default model. Supports `reload(model_name)` for switching.
- Lazy load on first call (not at startup)
- Reuse `_resolve_device()` pattern from `EmbeddingManager`

**Pattern to follow:** `backend/engine/models/embedding_model.py`

---

### Step 2: Extend VectorStore (modify existing)

**Modify:** `backend/engine/models/vectorstore.py`

**Implements:** FR-3.3, FR-3.4, FR-3.5, FR-2.1, FR-2.6, NFR-5.1, NFR-5.2

Add two new methods (do NOT change existing `search()`):

- `search_with_scores(query, k, collection_id=None)` -- returns `(List[Document], List[float], dict)` where distances and observability metadata (embedding dim, doc count) are included. Opens collection via `_get_or_create_collection` without mutating `_default_collection`.
- `get_collection_info(collection_id)` -- returns `{doc_count, metadata_keys_sample, collection_name}`

**Key constraint:** Must NOT mutate `_default_collection` (thread safety with ingestion).

---

### Step 3: Retrieval Controller (new file)

**Create:** `backend/engine/controllers/retrieval_controller.py`

**Implements:** FR-3.1, FR-6.6, FR-6.7, FR-7.1, FR-7.2, NFR-3.1, NFR-4.1

- `RetrievalController` singleton following `ingestion_controller.py` pattern
- `async search(collection_id, query, k, enable_reranking, rerank_k)`:
  1. Record timing per phase (embedding, search, reranking)
  2. Call `vectorstore_manager.search_with_scores()`
  3. If reranking enabled, call `reranker_manager.rerank()`
  4. Build response with results, timing, observability
- `async get_collection_info(collection_id)` -- delegates to vectorstore
- `async list_collections_with_counts()` -- extends `list_collections` with doc counts per collection

**Pattern to follow:** `backend/engine/controllers/ingestion_controller.py`

---

### Step 4: Retrieval Routes (new file)

**Create:** `backend/engine/routes/retrieval_routes.py`

**Implements:** FR-3.1, FR-5.3, NFR-3.1

- `router = APIRouter(prefix="/api/retrieval", tags=["retrieval"])`
- Pydantic request/response models for validation
- Endpoints:
  - `POST /api/retrieval/search` -- see API contract in 02-requirements.md
  - `GET /api/retrieval/collections` -- list with doc counts
  - `GET /api/retrieval/collection/{collection_id}/info` -- collection details

**Pattern to follow:** `backend/engine/routes/ingestion_routes.py`

---

### Step 5: Backend Configuration (modify existing)

**Modify:** `backend/engine/config/settings.py`

**Implements:** FR-6.8

- Add `RERANKER_MODEL: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"` env var

**Modify:** `backend/engine/config/ingestion_config.json`

**Implements:** FR-6.9

- Add `reranker_models` section (same structure as `embedding_models`):
  - `ms-marco-MiniLM-L-6-v2` (default, enabled, ~80MB)
  - `ms-marco-MiniLM-L-12-v2` (optional, disabled, ~130MB)

---

### Step 6: Register Router (modify existing)

**Modify:** `backend/engine/main.py`

- Import and include `retrieval_router` at line ~22 and ~117
- Add retrieval endpoints to root endpoint info dict at line ~127

---

### Step 7: Proxy Layer (new files + modify)

**Implements:** NFR-3.5

**Create:**
- `backend/proxy/services/retrievalService.js` -- axios calls to engine `/api/retrieval/*`
- `backend/proxy/controllers/retrievalController.js` -- request validation + delegation
- `backend/proxy/routes/retrievalRoutes.js` -- Express route definitions

**Modify:** `backend/proxy/index.js`
- Import and mount: `app.use('/api/retrieval', retrievalRoutes)` (after line 34)

**Pattern to follow:**
- `backend/proxy/services/ingestionService.js`
- `backend/proxy/controllers/ingestionController.js`
- `backend/proxy/routes/ingestionRoutes.js`

---

### Step 8: Frontend API Service (new file)

**Create:** `frontend/src/services/retrievalApi.js`

**Implements:** FR-3.6 (data layer)

Following `ingestionApi.js` pattern:
- `searchCollection(query, collectionId, params)` -- POST to `/api/retrieval/search`
- `getRetrievalCollections()` -- GET collections with counts
- `getCollectionInfo(collectionId)` -- GET collection details

**Pattern to follow:** `frontend/src/services/ingestionApi.js`

---

### Step 9: Frontend Custom Hook (new file)

**Create:** `frontend/src/hooks/useQueryTesting.js`

**Implements:** FR-5.4, FR-8.1, FR-8.2, FR-8.4, NFR-3.4

Internal `useReducer` with state:
```
{ query, collectionId, collections, params: {k, enableReranking, rerankK},
  results, timing, observability, isSearching, error, searchHistory }
```

Exposes: `setQuery`, `setCollectionId`, `updateParams`, `executeSearch`, `clearResults`, `loadCollections`

---

### Step 10: Frontend Presentational Components (new directory)

**Create:** `frontend/src/components/retrieval/`

**Implements:** FR-2.2, FR-3.6-3.11, FR-4.1-4.7, FR-5.1-5.5, FR-6.1-6.3, FR-7.3-7.5, FR-8.3, FR-9

| Component | Implements | Description |
|-----------|------------|-------------|
| `QueryInput.jsx` | FR-3.6, FR-3.7 | Textarea + search button, Ctrl+Enter shortcut |
| `SearchParamsPanel.jsx` | FR-5.1, FR-5.2, FR-5.5, FR-6.1, FR-6.2, FR-6.3, NFR-2.1 | Config-driven `PARAM_DEFINITIONS` array for extensibility |
| `ResultCard.jsx` | FR-3.9, FR-4.7 | Single result: rank, distance badge, expandable content |
| `MetadataDisplay.jsx` | FR-4.1-4.6, NFR-2.2 | Type-aware metadata rendering with registry pattern |
| `ObservabilityPanel.jsx` | FR-7.3, FR-7.4, FR-7.5 | Timing breakdown, model info, collection stats |
| `CollectionSelector.jsx` | FR-2.2, FR-2.3, FR-2.4, FR-2.5 | Dropdown with doc counts per collection |
| `ResultsList.jsx` | FR-3.9, FR-3.10 | Maps results to `ResultCard`, handles empty states |

---

### Step 11: Frontend Page Component (new file)

**Create:** `frontend/src/pages/QueryTestingPage.jsx`

**Implements:** All FR (composition)

Three-panel layout (matching IngestionPage style):
- **Left:** `CollectionSelector` + collection info
- **Center:** `QueryInput` at top, `ResultsList` below
- **Right:** `SearchParamsPanel` + `ObservabilityPanel`

Uses `useQueryTesting` hook. Uses existing `useBackendConfig` for initial collection list.

---

### Step 12: Frontend Navigation (modify + new)

**Create:** `frontend/src/components/NavBar.jsx`

**Implements:** FR-1.1, FR-1.2, FR-1.4

- Two tabs: "Ingestion" / "Query Testing"
- Minimal Tailwind-styled top bar

**Modify:** `frontend/src/App.jsx`

**Implements:** FR-1.3, FR-1.5

- Add `useState('ingestion')` for page switching
- Render `NavBar` + conditionally render pages (both stay mounted for state preservation)

---

## Files Summary

### New Files (15)

| File | Type |
|------|------|
| `backend/engine/models/reranker_model.py` | Backend model |
| `backend/engine/controllers/retrieval_controller.py` | Backend controller |
| `backend/engine/routes/retrieval_routes.py` | Backend routes |
| `backend/proxy/services/retrievalService.js` | Proxy service |
| `backend/proxy/controllers/retrievalController.js` | Proxy controller |
| `backend/proxy/routes/retrievalRoutes.js` | Proxy routes |
| `frontend/src/services/retrievalApi.js` | Frontend API |
| `frontend/src/hooks/useQueryTesting.js` | Frontend hook |
| `frontend/src/pages/QueryTestingPage.jsx` | Frontend page |
| `frontend/src/components/NavBar.jsx` | Frontend nav |
| `frontend/src/components/retrieval/QueryInput.jsx` | Frontend component |
| `frontend/src/components/retrieval/SearchParamsPanel.jsx` | Frontend component |
| `frontend/src/components/retrieval/ResultCard.jsx` | Frontend component |
| `frontend/src/components/retrieval/MetadataDisplay.jsx` | Frontend component |
| `frontend/src/components/retrieval/ObservabilityPanel.jsx` | Frontend component |
| `frontend/src/components/retrieval/CollectionSelector.jsx` | Frontend component |
| `frontend/src/components/retrieval/ResultsList.jsx` | Frontend component |

### Modified Files (5)

| File | Change |
|------|--------|
| `backend/engine/models/vectorstore.py` | Add `search_with_scores`, `get_collection_info` |
| `backend/engine/config/settings.py` | Add `RERANKER_MODEL` |
| `backend/engine/config/ingestion_config.json` | Add `reranker_models` section |
| `backend/engine/main.py` | Register retrieval router |
| `backend/proxy/index.js` | Mount retrieval routes |
| `frontend/src/App.jsx` | Add NavBar + page switching |

---

## Potential Challenges

| Challenge | Mitigation |
|-----------|------------|
| Collection switching thread safety | `search_with_scores` uses read-only temporary client, never mutates singleton state |
| CrossEncoder model size (~80MB) | Lazy loading; clear log message when loading starts |
| Metadata deserialization | `_clean_metadata` serializes lists as JSON; `MetadataDisplay` tries JSON.parse, falls back to string |
| Large result sets (k=50) | Cap at 50 in backend validation; simple rendering (no virtual scroll needed for 50 items) |
| First rerank latency | Show loading indicator + toast message explaining model download |

---

## Verification Plan

1. **Backend unit test**: `POST /api/retrieval/search` with a test collection returns results with distances and timing
2. **Reranking test**: Same search with `enableReranking=true` returns reordered results with `rerankScore`
3. **Collection info**: `GET /api/retrieval/collection/{id}/info` returns doc count and metadata keys
4. **Frontend E2E**: Navigate to Query Testing page -> select collection -> enter query -> see results with metadata and timing panel
5. **Reranking toggle**: Enable reranking -> verify results reorder and observability shows reranker model
6. **Edge cases**: Empty collection, no results for query, collection not found, reranker first-load latency
7. **Navigation**: Switch between Ingestion and Query Testing pages, verify state is preserved on both
