/**
 * Ingestion Contexts
 * 
 * React contexts for split state management.
 * Separated from provider component for Fast Refresh compatibility.
 */

import { createContext } from 'react';

/**
 * File Queue Context
 * Contains: uploadQueue, ingestedFiles, selectedDocumentId
 */
export const FileQueueContext = createContext(null);

/**
 * Document Context
 * Contains: documentState, currentPage, contentType, storedEmbeddings
 */
export const DocumentContext = createContext(null);

/**
 * Preview Context
 * Contains: isPreviewMode, isLoadingPreview, embeddingPreview, previewConfig, previewDocumentIds
 */
export const PreviewContext = createContext(null);

/**
 * UI Context
 * Contains: mode, sidebars, multiSelect, modals, helpers, etc.
 */
export const UIContext = createContext(null);

/**
 * Dispatch Context
 * Contains: dispatch function (stable reference, never causes re-renders)
 */
export const DispatchContext = createContext(null);
