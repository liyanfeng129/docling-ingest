# User Stories - Query Testing Page

## Epic: Retrieval Quality Testing

As a user who has ingested documents into vector collections, I want to test and evaluate the quality of my retrieval pipeline so that I can tune parameters and gain confidence before integrating into a production RAG system.

---

## US-1: Navigate to Query Testing Page

**As a** user
**I want to** switch between the Ingestion page and the Query Testing page
**So that** I can access retrieval testing without leaving the application

**Acceptance Criteria:**
- A persistent navigation bar is visible on all pages
- I can click "Ingestion" or "Query Testing" tabs to switch pages
- The active page is visually highlighted
- Switching pages does not lose the other page's state (ingestion state preserved)

**Priority:** High
**Size:** S

---

## US-2: Select a Collection to Query

**As a** user
**I want to** select which vector collection to search against
**So that** I can test queries on different document sets

**Acceptance Criteria:**
- I see a dropdown listing all available ChromaDB collections
- Each collection shows its name and document count
- I can switch between collections freely
- The currently selected collection is clearly indicated
- If no collections exist, I see a message directing me to ingest documents first

**Priority:** High
**Size:** S

---

## US-3: Execute a Similarity Search

**As a** user
**I want to** type a query and run a similarity search
**So that** I can see what documents are retrieved for a given question

**Acceptance Criteria:**
- I see a text input area for typing my query
- I can trigger the search with a "Search" button or Ctrl+Enter keyboard shortcut
- While searching, I see a loading indicator
- Results appear below the query input after search completes
- Each result shows the text content of the retrieved chunk
- Results are ordered by relevance (closest first)
- If no results are found, I see a clear "no results" message
- If an error occurs, I see a descriptive error message

**Priority:** High
**Size:** M

---

## US-4: View Similarity Scores

**As a** user
**I want to** see the similarity distance/score for each result
**So that** I can evaluate how closely each chunk matches my query

**Acceptance Criteria:**
- Each result card displays its cosine distance score
- Scores are formatted clearly (e.g., "Distance: 0.234")
- Results are ranked by score (lowest distance = most similar first)

**Priority:** High
**Size:** S

---

## US-5: View Result Metadata

**As a** user
**I want to** see the metadata associated with each retrieved chunk
**So that** I can understand the source, page, and context of each result

**Acceptance Criteria:**
- Each result displays its metadata in a readable format
- Common metadata fields are rendered with appropriate formatting:
  - `source` / filename -> filename badge
  - `page_number` / `page_range` -> page badge
  - `strategy` -> strategy label
  - `chunk_index` -> chunk number
  - `images` (JSON-encoded list) -> parsed and displayed as image thumbnails
- Unknown/custom metadata fields are shown as key-value pairs
- Long metadata values are truncatable/expandable
- Empty metadata is handled gracefully (no broken UI)

**Priority:** High
**Size:** M

---

## US-6: Configure Number of Results (k)

**As a** user
**I want to** set how many results the similarity search returns
**So that** I can test different retrieval depths

**Acceptance Criteria:**
- I see a number input for "k" (number of results)
- Default value is 8
- Minimum is 1, maximum is 50
- The value persists across searches within the same session
- Changing k and re-searching reflects the new value

**Priority:** High
**Size:** S

---

## US-7: Enable and Configure Reranking

**As a** user
**I want to** optionally enable a reranking step after similarity search
**So that** I can compare retrieval quality with and without reranking

**Acceptance Criteria:**
- I see a toggle to enable/disable reranking
- When reranking is enabled, I see an additional input for "Rerank Top-K"
- When reranking is disabled, the rerank_k input is hidden
- Reranked results show both the original distance and the rerank score
- Reranked results are reordered by rerank score (highest = most relevant first)
- First-time use of reranking may take longer (model loading); a message indicates this
- Default rerank_k is 3

**Priority:** High
**Size:** M

---

## US-8: View Search Timing and Observability Metrics

**As a** user
**I want to** see timing breakdowns and technical details of each search
**So that** I can understand performance characteristics and debug issues

**Acceptance Criteria:**
- After each search, I see an observability panel with:
  - Total search time (ms)
  - Embedding generation time (ms)
  - Vector search time (ms)
  - Reranking time (ms) -- only when reranking is enabled
- I also see:
  - Embedding model name and dimensions
  - Total documents in the queried collection
  - Query character length
- Timing updates with each new search

**Priority:** Medium
**Size:** S

---

## US-9: Expand/Collapse Result Content

**As a** user
**I want to** expand long result texts and collapse them again
**So that** I can scan results quickly but read full content when needed

**Acceptance Criteria:**
- Long result texts (>300 chars) are truncated by default
- An "Expand" / "Collapse" toggle reveals the full text
- Short results are shown in full without truncation

**Priority:** Medium
**Size:** S

---

## US-10: Keep Search History in Session

**As a** user
**I want to** see my recent searches during the current session
**So that** I can compare results across different queries or parameter settings

**Acceptance Criteria:**
- The last N searches (query + params + result count + timing) are listed
- I can click a past search to re-run it with the same parameters
- History is cleared when the page is refreshed (session-only)
- History has a reasonable limit (e.g., 20 entries)

**Priority:** Low
**Size:** M

---

## US-11: Configure Reranker Model

**As an** advanced user / admin
**I want to** choose which reranking model to use
**So that** I can test different rerankers for quality/speed tradeoffs

**Acceptance Criteria:**
- Available reranker models are listed in the backend config
- Default model is `cross-encoder/ms-marco-MiniLM-L-6-v2`
- The reranker model can be changed via environment variable (`RERANKER_MODEL`)
- Switching models triggers model reload on next rerank request
- The currently active reranker model name is visible in the observability panel

**Priority:** Low
**Size:** S

---

## Story Map

```
                    Navigation (US-1)
                         |
              +----------+----------+
              |                     |
     Ingestion Page          Query Testing Page
     (existing)                     |
                    +---------------+---------------+
                    |               |               |
             Collection       Search Core     Observability
             Selection        (US-3, US-4)     (US-8)
             (US-2)                |
                    +--------------+--------------+
                    |              |              |
              Metadata       Parameters      Reranking
              Display       (US-6)          (US-7, US-11)
              (US-5, US-9)

              Search History (US-10)
```

---

## Priority Summary

| Priority | Stories | Notes |
|----------|---------|-------|
| **High** | US-1, US-2, US-3, US-4, US-5, US-6, US-7 | Core functionality, must-have for MVP |
| **Medium** | US-8, US-9 | Enhances usability, high value / low effort |
| **Low** | US-10, US-11 | Nice-to-have, can be deferred |
