# Implementation Plan - LLM Query Export

## Overview

Add an "Export to LLM" button to the Query Testing page that generates a structured markdown prompt from the current query and retrieved documents, ready to copy-paste into any LLM.

## Output Format

The generated markdown follows this structure:

```markdown
# Context-Based Question Answering

You are given a question and a set of retrieved documents from a knowledge base. Answer the question based **only** on the provided context. If the context does not contain enough information to answer, say so.

---

## Question

{user's query}

---

## Retrieved Documents

### Document 1
- **Source:** {filename}
- **Page:** {page_number}
- **Chunk:** {chunk_index}

{document content}

### Document 2
- **Source:** {filename}
- **Page:** {page_number}
- **Chunk:** {chunk_index}

{document content}

...

---

## Instructions

Based on the documents above, provide a comprehensive answer to the question. Cite the document numbers (e.g., [Document 1]) when referencing specific information.
```

---

## Implementation Steps

### Step 1: Markdown Generator Utility

**Create:** `frontend/src/utils/llmExport.js`

Pure function, no React dependencies:

```js
export function generateLlmPrompt({ query, results, options }) → string
```

- `query` — the search query string
- `results` — array of result objects from the search (same shape as `ResultCard` receives)
- `options` — `{ includeMetadata: bool, includeScores: bool, maxDocuments: number | null }`

Logic:
1. Build header with system instruction
2. Add query section
3. For each result (up to `maxDocuments`):
   - Add document header with rank number
   - If `includeMetadata`: add source, page, chunk as bullet points
   - If `includeScores`: add distance and rerank score as bullet points
   - Add document content (full, not truncated)
4. Add closing instruction section
5. Return the complete markdown string

### Step 2: Export Modal Component

**Create:** `frontend/src/components/retrieval/LlmExportModal.jsx`

A modal dialog that shows the generated markdown and export options.

**Props:**
- `isOpen: bool`
- `onClose: () => void`
- `query: string`
- `results: array`

**Internal state:**
- `includeMetadata` (default: `true`)
- `includeScores` (default: `false`)
- `maxDocuments` (default: `null` = all)
- `copied` (transient flag for copy feedback)

**UI layout:**
```
┌─────────────────────────────────────────────┐
│  Export to LLM                         [X]  │
├─────────────────────────────────────────────┤
│  Options:                                   │
│  [✓] Include metadata  [ ] Include scores   │
│  Max documents: [all ▼]                     │
├─────────────────────────────────────────────┤
│  ┌─────────────────────────────────────┐    │
│  │  (markdown preview, scrollable)     │    │
│  │  ...                                │    │
│  └─────────────────────────────────────┘    │
├─────────────────────────────────────────────┤
│                    [Copy to Clipboard]      │
└─────────────────────────────────────────────┘
```

- Preview area: `<pre>` or `<textarea readonly>` with monospace font, max-height with scroll
- Copy button uses `navigator.clipboard.writeText()`, shows "Copied!" for 2 seconds
- Options at top regenerate preview in real-time via `useMemo`

### Step 3: Integrate into ResultsList

**Modify:** `frontend/src/components/retrieval/ResultsList.jsx`

- Add an "Export to LLM" button in the results header area (next to result count or similar)
- Button disabled when `results.length === 0`
- Manages `isExportModalOpen` state
- Passes `query` and `results` to `LlmExportModal`

**Requires:** `query` prop to be passed down from `QueryTestingPage` (check if already available, otherwise thread it through)

### Step 4: Wire Up in QueryTestingPage

**Modify:** `frontend/src/pages/QueryTestingPage.jsx`

- Ensure `query` is passed as a prop to `ResultsList` (may already be the case via the hook)
- No other changes expected

---

## Files Changed

| File | Action | Size |
|------|--------|------|
| `frontend/src/utils/llmExport.js` | Create | S |
| `frontend/src/components/retrieval/LlmExportModal.jsx` | Create | M |
| `frontend/src/components/retrieval/ResultsList.jsx` | Modify | S |
| `frontend/src/pages/QueryTestingPage.jsx` | Modify (if needed) | XS |

## No Backend Changes Required

This feature is entirely frontend — it transforms already-fetched data into markdown text.
