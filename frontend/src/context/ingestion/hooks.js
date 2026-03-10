/**
 * Ingestion Hooks
 * 
 * Custom hooks for accessing ingestion state and dispatching actions.
 * 
 * Domain-specific hooks:
 * - useFileQueue() - File upload queue and ingested files
 * - useDocument() - Current document state and editing
 * - usePreview() - Embedding preview state
 * - useUI() - UI state (sidebars, modals, modes)
 * - useDispatch() - Dispatch function (stable, never causes re-renders)
 * 
 * Action creator hook:
 * - useIngestionActions() - Pre-bound action creators for cleaner component code
 * 
 * @see doc/ingestion/ADR.md ADR-002 for architectural decisions
 */

import { useContext, useMemo } from 'react';
import {
    FileQueueContext,
    DocumentContext,
    PreviewContext,
    UIContext,
    DispatchContext,
} from './contexts';
import * as ActionTypes from './actionTypes';
import { MODAL_TYPES } from './constants';

// ============================================
// DOMAIN-SPECIFIC STATE HOOKS
// ============================================

/**
 * Access file queue state
 * Re-renders only when fileQueue domain changes
 */
export function useFileQueue() {
    const context = useContext(FileQueueContext);
    if (context === null) {
        throw new Error('useFileQueue must be used within IngestionProvider');
    }
    return context;
}

/**
 * Access document state
 * Re-renders only when document domain changes
 */
export function useDocument() {
    const context = useContext(DocumentContext);
    if (context === null) {
        throw new Error('useDocument must be used within IngestionProvider');
    }
    return context;
}

/**
 * Access preview state
 * Re-renders only when preview domain changes
 */
export function usePreview() {
    const context = useContext(PreviewContext);
    if (context === null) {
        throw new Error('usePreview must be used within IngestionProvider');
    }
    return context;
}

/**
 * Access UI state
 * Re-renders only when ui domain changes
 */
export function useUI() {
    const context = useContext(UIContext);
    if (context === null) {
        throw new Error('useUI must be used within IngestionProvider');
    }
    return context;
}

/**
 * Access dispatch function
 * Stable reference - NEVER causes re-renders
 */
export function useDispatch() {
    const context = useContext(DispatchContext);
    if (context === null) {
        throw new Error('useDispatch must be used within IngestionProvider');
    }
    return context;
}

// ============================================
// ACTION CREATOR HOOKS
// ============================================

/**
 * Pre-bound action creators for cleaner component code
 * 
 * Usage:
 * ```jsx
 * const actions = useIngestionActions();
 * actions.selectFile(documentId);
 * actions.changePage(2);
 * ```
 */
export function useIngestionActions() {
    const dispatch = useDispatch();

    return useMemo(() => ({
        // File Queue Actions
        startFileUpload: (id, file, filename) => dispatch({
            type: ActionTypes.FILE_UPLOAD_STARTED,
            payload: { id, file, filename },
        }),

        updateFileProgress: (id, status, progress) => dispatch({
            type: ActionTypes.FILE_UPLOAD_PROGRESS,
            payload: { id, status, progress },
        }),

        completeFileUpload: (id, documentId) => dispatch({
            type: ActionTypes.FILE_UPLOAD_COMPLETE,
            payload: { id, documentId },
        }),

        failFileUpload: (id, error) => dispatch({
            type: ActionTypes.FILE_UPLOAD_FAILED,
            payload: { id, error },
        }),

        selectFile: (documentId) => dispatch({
            type: ActionTypes.FILE_SELECTED,
            payload: { documentId },
        }),

        removeFile: (documentId) => dispatch({
            type: ActionTypes.FILE_REMOVED,
            payload: { documentId },
        }),

        renameFile: (documentId, newFilename) => dispatch({
            type: ActionTypes.FILE_RENAMED,
            payload: { documentId, newFilename },
        }),

        restoreFilesFromCache: (uploadQueue) => dispatch({
            type: ActionTypes.FILES_RESTORED_FROM_CACHE,
            payload: { uploadQueue },
        }),

        loadIngestedFiles: (ingestedFiles) => dispatch({
            type: ActionTypes.INGESTED_FILES_LOADED,
            payload: { ingestedFiles },
        }),

        removeIngestedFile: (ingestedId) => dispatch({
            type: ActionTypes.INGESTED_FILE_REMOVED,
            payload: { ingestedId },
        }),

        // Document Actions
        loadDocument: (documentState, documentId) => dispatch({
            type: ActionTypes.DOCUMENT_LOADED,
            payload: { documentState, documentId },
        }),

        modifyDocument: (documentState) => dispatch({
            type: ActionTypes.DOCUMENT_MODIFIED,
            payload: { documentState },
        }),

        resetDocument: () => dispatch({
            type: ActionTypes.DOCUMENT_RESET,
        }),

        changePage: (page) => dispatch({
            type: ActionTypes.PAGE_CHANGED,
            payload: { page },
        }),

        setContentType: (contentType) => dispatch({
            type: ActionTypes.CONTENT_TYPE_CHANGED,
            payload: { contentType },
        }),

        setStoredEmbeddings: (embeddings, documentId) => dispatch({
            type: ActionTypes.STORED_EMBEDDINGS_SET,
            payload: { embeddings, documentId },
        }),

        // Preview Actions
        startPreview: (targetDb, strategy, documentIds, rightSidebarState) => dispatch({
            type: ActionTypes.PREVIEW_STARTED,
            payload: { targetDb, strategy, documentIds, rightSidebarState },
        }),

        setPreviewGenerated: (embeddingPreview) => dispatch({
            type: ActionTypes.PREVIEW_GENERATED,
            payload: { embeddingPreview },
        }),

        failPreview: (rightSidebarState) => dispatch({
            type: ActionTypes.PREVIEW_FAILED,
            payload: { rightSidebarState },
        }),

        cancelPreview: (rightSidebarState) => dispatch({
            type: ActionTypes.PREVIEW_CANCELLED,
            payload: { rightSidebarState },
        }),

        switchPreviewFile: (documentId, embeddingPreview) => dispatch({
            type: ActionTypes.PREVIEW_FILE_SWITCHED,
            payload: { documentId, embeddingPreview },
        }),

        removePreviewFile: (documentId) => dispatch({
            type: ActionTypes.PREVIEW_FILE_REMOVED,
            payload: { documentId },
        }),

        // Ingestion Actions
        startIngestion: () => dispatch({
            type: ActionTypes.INGESTION_STARTED,
        }),

        updateIngestionProgress: (progress) => dispatch({
            type: ActionTypes.INGESTION_PROGRESS,
            payload: { progress },
        }),

        completeIngestion: (documentId, ingestedEntry, ingestedData, rightSidebarState) => dispatch({
            type: ActionTypes.INGESTION_COMPLETE,
            payload: { documentId, ingestedEntry, ingestedData, rightSidebarState },
        }),

        completeBatchIngestion: (ingestedEntries, rightSidebarState) => dispatch({
            type: ActionTypes.INGESTION_BATCH_COMPLETE,
            payload: { ingestedEntries, rightSidebarState },
        }),

        failIngestion: () => dispatch({
            type: ActionTypes.INGESTION_FAILED,
        }),

        // UI Actions
        toggleLeftSidebar: () => dispatch({
            type: ActionTypes.LEFT_SIDEBAR_TOGGLED,
        }),

        toggleRightSidebar: () => dispatch({
            type: ActionTypes.RIGHT_SIDEBAR_TOGGLED,
        }),

        toggleMultiSelect: () => dispatch({
            type: ActionTypes.MULTI_SELECT_TOGGLED,
        }),

        checkDocument: (documentId) => dispatch({
            type: ActionTypes.DOCUMENT_CHECKED,
            payload: { documentId },
        }),

        clearCheckedDocuments: () => dispatch({
            type: ActionTypes.CHECKED_DOCUMENTS_CLEARED,
        }),

        setDragging: (isDragging) => dispatch({
            type: ActionTypes.DRAGGING_CHANGED,
            payload: { isDragging },
        }),

        // Modal Actions
        openModal: (modalType) => dispatch({
            type: ActionTypes.MODAL_OPENED,
            payload: { modalType },
        }),

        closeModal: () => dispatch({
            type: ActionTypes.MODAL_CLOSED,
        }),

        openHelperFileSelectModal: () => dispatch({
            type: ActionTypes.MODAL_OPENED,
            payload: { modalType: MODAL_TYPES.HELPER_FILE_SELECT },
        }),

        // Helper Actions
        startHelper: (helperId) => dispatch({
            type: ActionTypes.HELPER_STARTED,
            payload: { helperId },
        }),

        completeHelper: () => dispatch({
            type: ActionTypes.HELPER_COMPLETED,
        }),

        failHelper: () => dispatch({
            type: ActionTypes.HELPER_FAILED,
        }),

        setPendingHelper: (helper) => dispatch({
            type: ActionTypes.PENDING_HELPER_SET,
            payload: { helper },
        }),

        clearPendingHelper: () => dispatch({
            type: ActionTypes.PENDING_HELPER_CLEARED,
        }),

        // Convenience Actions (composite/aliased)

        // Update filename is an alias for renameFile
        updateFilename: (documentId, newFilename) => dispatch({
            type: ActionTypes.FILE_RENAMED,
            payload: { documentId, newFilename },
        }),

        // Clear all files (for cache management)
        clearAllFiles: () => dispatch({
            type: ActionTypes.FILES_RESTORED_FROM_CACHE,
            payload: { uploadQueue: [], ingestedFiles: [] },
        }),

        // Exit preview mode (alias for cancelPreview)
        exitPreviewMode: (rightSidebarState = false) => dispatch({
            type: ActionTypes.PREVIEW_CANCELLED,
            payload: { rightSidebarState },
        }),
    }), [dispatch]);
}

