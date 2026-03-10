/**
 * Ingestion Components Index
 * 
 * Central export for all ingestion-related components.
 * 
 * Architecture: Context + Reducer pattern (ADR-002)
 * - Connected components own their business logic and subscribe to context
 * - Pure UI components receive props and have no context dependency
 * 
 * Folder Structure:
 * ingestion/
 * ├── index.js              - This file (central exports)
 * ├── connected/            - Components with context hooks (business logic)
 * │   ├── ConnectedUploadZone.jsx
 * │   ├── ConnectedFileQueue.jsx
 * │   ├── ConnectedContentViewer.jsx
 * │   └── ConnectedHelperPanel.jsx
 * ├── content/              - Pure UI components for content display
 * │   ├── PageContent.jsx
 * │   ├── PageNavigation.jsx
 * │   ├── TextItem.jsx
 * │   ├── ImageItem.jsx
 * │   ├── TableItem.jsx
 * │   ├── FileQueueItem.jsx
 * │   ├── EmbeddingPreviewViewer.jsx
 * │   └── SaveBar.jsx
 * └── modals/               - Modal/Dialog components
 *     ├── IngestionModal.jsx
 *     ├── RegexInputModal.jsx
 *     ├── HelperFileSelectModal.jsx
 *     └── CacheManagement.jsx
 * 
 * @see doc/ingestion/ADR.md ADR-002 for architectural decisions
 * @see doc/ingestion/COMPONENT_RESPONSIBILITIES.md
 */

// ===== Connected Components =====
// These components use context hooks directly and own their business logic
export { default as ConnectedFileQueue } from './connected/ConnectedFileQueue';
export { default as ConnectedUploadZone } from './connected/ConnectedUploadZone';
export { default as ConnectedContentViewer } from './connected/ConnectedContentViewer';
export { default as ConnectedHelperPanel } from './connected/ConnectedHelperPanel';

// ===== Content Components (Pure UI) =====
// These components receive props and have no context dependency
export { default as FileQueueItem } from './content/FileQueueItem';
export { default as PageNavigation } from './content/PageNavigation';
export { default as PageContent } from './content/PageContent';
export { default as TextItem } from './content/TextItem';
export { default as ImageItem } from './content/ImageItem';
export { default as TableItem } from './content/TableItem';
export { default as SaveBar } from './content/SaveBar';
export { default as EmbeddingPreviewViewer } from './content/EmbeddingPreviewViewer';

// ===== Modal Components =====
export { default as IngestionModal } from './modals/IngestionModal';
export { default as RegexInputModal } from './modals/RegexInputModal';
export { default as HelperFileSelectModal } from './modals/HelperFileSelectModal';
export { default as CacheManagement } from './modals/CacheManagement';
