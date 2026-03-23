# User Stories - LLM Query Export

**Status:** planned

## Epic: Export Retrieval Results for LLM Evaluation

As a user testing retrieval quality, I want to export my query and retrieved documents as a structured markdown prompt so that I can paste it into an LLM and evaluate the generated answer against my retrieved context.

---

## US-1: Export Current Results as LLM Prompt

**As a** user who has run a similarity search
**I want to** click a button to generate a structured markdown prompt containing my query and all retrieved documents
**So that** I can copy-paste it into an LLM (ChatGPT, Claude, etc.) and see the generated answer

**Acceptance Criteria:**
- An "Export to LLM" button is visible in the results area after a search completes
- The button is disabled when there are no results
- Clicking the button generates a structured markdown document
- The markdown is displayed in a modal/panel for review before copying
- A "Copy to Clipboard" button copies the full markdown to clipboard
- Visual feedback confirms the copy succeeded (e.g., button text changes to "Copied!")

**Priority:** High
**Size:** M

---

## US-2: Structured Markdown Format

**As a** user pasting context into an LLM
**I want** the exported markdown to be well-structured with clear sections
**So that** the LLM can understand the context and produce a high-quality answer

**Acceptance Criteria:**
- The markdown includes a system instruction section explaining the task
- The query is clearly labeled in its own section
- Each retrieved document is numbered and separated with its content and source metadata
- Metadata (source filename, page number, chunk index) is included per document for traceability
- The format ends with a clear instruction asking the LLM to answer based on the provided context
- The markdown is human-readable and not overly verbose

**Priority:** High
**Size:** S

---

## US-3: Customizable Export Options

**As a** user
**I want to** optionally adjust the export before copying
**So that** I can tailor the prompt to my specific LLM or use case

**Acceptance Criteria:**
- Option to include/exclude metadata per document (default: include)
- Option to include/exclude retrieval scores (distance, rerank score) (default: exclude)
- Option to limit the number of documents exported (default: all results)
- Options are remembered within the session

**Priority:** Medium
**Size:** S
