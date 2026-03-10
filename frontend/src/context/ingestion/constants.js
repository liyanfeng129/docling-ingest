/**
 * Constants for Ingestion State Management
 * 
 * Shared constants used across the ingestion feature.
 */

/**
 * Document status in the upload queue
 */
export const DOC_STATUS = {
    QUEUED: 'queued',
    UPLOADING: 'uploading',
    PROCESSING: 'processing',
    READY: 'ready',
    ERROR: 'error',
};

/**
 * Content type displayed in the main viewer
 */
export const CONTENT_TYPE = {
    EDITOR: 'editor',      // Editable document pages
    EMBEDDING: 'embedding', // Read-only stored embeddings
};

/**
 * UI mode states
 */
export const UI_MODE = {
    EDITING: 'editing',    // Normal editing mode
    PREVIEW: 'preview',    // Embedding preview before ingestion
    READONLY: 'readonly',  // Read-only mode (after ingestion)
};

/**
 * Modal types
 */
export const MODAL_TYPES = {
    INGEST: 'ingest',
    REGEX: 'regex',
    CACHE_MANAGEMENT: 'cache_management',
    HELPER_FILE_SELECT: 'helper_file_select',
};
