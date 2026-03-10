/**
 * Ingestion Reducer
 * 
 * Central state management for the Ingestion Page.
 * All state transitions are handled here for traceability.
 * 
 * State is split into domains for fine-grained re-renders via split contexts:
 * - fileQueue: File upload queue and ingested files
 * - document: Current document state and editing
 * - preview: Embedding preview state
 * - ui: UI state (sidebars, modals, modes)
 * 
 * @see doc/ingestion/REDUCER.md for detailed documentation
 * @see doc/ingestion/ADR.md ADR-002 for architectural decisions
 */

import * as ActionTypes from './actionTypes';
import { DOC_STATUS, CONTENT_TYPE, UI_MODE, MODAL_TYPES } from './constants';

/**
 * Initial state structure
 */
export const initialState = {
    // File Queue Domain - manages uploaded and ingested files
    fileQueue: {
        uploadQueue: [],           // [{ id, documentId, filename, status, progress, error }]
        ingestedFiles: [],         // [{ ingestedId, documentId, filename, strategy, timestamp }]
        selectedDocumentId: null,  // Currently selected file
    },

    // Document Domain - manages current document content and editing
    document: {
        documentState: null,       // { filename, documentId, pages: [...] } - from useCommandHistory
        currentPage: 1,
        contentType: CONTENT_TYPE.EDITOR,
        storedEmbeddings: null,    // Stored embeddings for read-only view
        // Note: Command history (undo/redo) is managed by useCommandHistory hook
    },

    // Preview Domain - manages embedding preview state
    preview: {
        isPreviewMode: false,
        isLoadingPreview: false,
        embeddingPreview: null,    // Preview data from API
        previewConfig: {           // Config used for preview
            targetDb: '',
            strategy: '',
        },
        previewDocumentIds: new Set(), // Document IDs in current preview (for multi-file)
    },

    // UI Domain - manages UI state
    ui: {
        mode: UI_MODE.EDITING,     // 'editing' | 'preview' | 'readonly'
        leftSidebarCollapsed: false,
        rightSidebarCollapsed: false,
        rightSidebarStateBeforePreview: false, // Store state before entering preview
        isDragging: false,         // Drag state for upload zone
        multiSelectMode: false,
        checkedDocumentIds: new Set(),
        isIngesting: false,
        ingestionProgress: 0,
        runningHelper: null,       // Currently running helper ID
        pendingHelper: null,       // Helper waiting for file selection
        // Modal states
        activeModal: null,         // Current open modal (or null)
    },
};

/**
 * Main reducer function
 * 
 * Handles all state transitions atomically.
 * Cross-domain actions update multiple domains in a single dispatch.
 */
export function ingestionReducer(state, action) {
    switch (action.type) {
        // ============================================
        // FILE QUEUE ACTIONS
        // ============================================

        case ActionTypes.FILE_UPLOAD_STARTED: {
            const { id, file, filename } = action.payload;
            return {
                ...state,
                fileQueue: {
                    ...state.fileQueue,
                    uploadQueue: [
                        ...state.fileQueue.uploadQueue,
                        {
                            id,
                            file,
                            filename,
                            status: DOC_STATUS.QUEUED,
                            progress: 0,
                        },
                    ],
                },
            };
        }

        case ActionTypes.FILE_UPLOAD_PROGRESS: {
            const { id, status, progress } = action.payload;
            return {
                ...state,
                fileQueue: {
                    ...state.fileQueue,
                    uploadQueue: state.fileQueue.uploadQueue.map(f =>
                        f.id === id ? { ...f, status, progress } : f
                    ),
                },
            };
        }

        case ActionTypes.FILE_UPLOAD_COMPLETE: {
            const { id, documentId } = action.payload;
            return {
                ...state,
                fileQueue: {
                    ...state.fileQueue,
                    uploadQueue: state.fileQueue.uploadQueue.map(f =>
                        f.id === id
                            ? { ...f, documentId, status: DOC_STATUS.READY, progress: 100 }
                            : f
                    ),
                },
            };
        }

        case ActionTypes.FILE_UPLOAD_FAILED: {
            const { id, error } = action.payload;
            return {
                ...state,
                fileQueue: {
                    ...state.fileQueue,
                    uploadQueue: state.fileQueue.uploadQueue.map(f =>
                        f.id === id
                            ? { ...f, status: DOC_STATUS.ERROR, error }
                            : f
                    ),
                },
            };
        }

        case ActionTypes.FILE_SELECTED: {
            const { documentId } = action.payload;
            return {
                ...state,
                fileQueue: {
                    ...state.fileQueue,
                    selectedDocumentId: documentId,
                },
            };
        }

        case ActionTypes.FILE_REMOVED: {
            const { documentId } = action.payload;
            const isSelected = state.fileQueue.selectedDocumentId === documentId;
            return {
                ...state,
                fileQueue: {
                    ...state.fileQueue,
                    uploadQueue: state.fileQueue.uploadQueue.filter(
                        f => f.documentId !== documentId
                    ),
                    selectedDocumentId: isSelected ? null : state.fileQueue.selectedDocumentId,
                },
                // Clear document state if this was selected
                document: isSelected
                    ? {
                        ...state.document,
                        documentState: null,
                        contentType: CONTENT_TYPE.EDITOR,
                        storedEmbeddings: null,
                    }
                    : state.document,
            };
        }

        case ActionTypes.FILE_RENAMED: {
            const { documentId, newFilename } = action.payload;
            return {
                ...state,
                fileQueue: {
                    ...state.fileQueue,
                    uploadQueue: state.fileQueue.uploadQueue.map(f =>
                        f.documentId === documentId ? { ...f, filename: newFilename } : f
                    ),
                },
            };
        }

        case ActionTypes.FILES_RESTORED_FROM_CACHE: {
            const { uploadQueue, ingestedFiles } = action.payload;
            return {
                ...state,
                fileQueue: {
                    ...state.fileQueue,
                    uploadQueue,
                    // Also clear ingestedFiles if provided (for cache clear)
                    ...(ingestedFiles !== undefined && { ingestedFiles }),
                },
                // Reset document state when clearing all files
                ...(uploadQueue.length === 0 && {
                    document: {
                        ...state.document,
                        documentState: null,
                        currentPage: 0,
                        contentType: null,
                        storedEmbeddings: null,
                    },
                }),
            };
        }

        case ActionTypes.INGESTED_FILES_LOADED: {
            const { ingestedFiles } = action.payload;
            return {
                ...state,
                fileQueue: {
                    ...state.fileQueue,
                    ingestedFiles,
                },
            };
        }

        case ActionTypes.INGESTED_FILE_REMOVED: {
            const { ingestedId } = action.payload;
            const isSelected = state.fileQueue.selectedDocumentId === ingestedId;
            return {
                ...state,
                fileQueue: {
                    ...state.fileQueue,
                    ingestedFiles: state.fileQueue.ingestedFiles.filter(
                        f => f.ingestedId !== ingestedId
                    ),
                    selectedDocumentId: isSelected ? null : state.fileQueue.selectedDocumentId,
                },
                document: isSelected
                    ? {
                        ...state.document,
                        storedEmbeddings: null,
                        contentType: CONTENT_TYPE.EDITOR,
                    }
                    : state.document,
            };
        }

        // ============================================
        // DOCUMENT ACTIONS
        // ============================================

        case ActionTypes.DOCUMENT_LOADED: {
            const { documentState, documentId } = action.payload;
            return {
                ...state,
                fileQueue: {
                    ...state.fileQueue,
                    selectedDocumentId: documentId,
                },
                document: {
                    ...state.document,
                    documentState,
                    currentPage: 1,
                    contentType: CONTENT_TYPE.EDITOR,
                    storedEmbeddings: null,
                },
            };
        }

        case ActionTypes.DOCUMENT_MODIFIED: {
            const { documentState } = action.payload;
            return {
                ...state,
                document: {
                    ...state.document,
                    documentState,
                },
            };
        }

        case ActionTypes.DOCUMENT_RESET: {
            return {
                ...state,
                document: {
                    ...state.document,
                    documentState: null,
                    currentPage: 1,
                },
            };
        }

        case ActionTypes.PAGE_CHANGED: {
            const { page } = action.payload;
            return {
                ...state,
                document: {
                    ...state.document,
                    currentPage: page,
                },
            };
        }

        case ActionTypes.CONTENT_TYPE_CHANGED: {
            const { contentType } = action.payload;
            return {
                ...state,
                document: {
                    ...state.document,
                    contentType,
                },
            };
        }

        case ActionTypes.STORED_EMBEDDINGS_SET: {
            const { embeddings, documentId } = action.payload;
            return {
                ...state,
                fileQueue: {
                    ...state.fileQueue,
                    selectedDocumentId: documentId,
                },
                document: {
                    ...state.document,
                    storedEmbeddings: embeddings,
                    contentType: CONTENT_TYPE.EMBEDDING,
                    documentState: null,
                    currentPage: 1,
                },
            };
        }

        // ============================================
        // PREVIEW ACTIONS
        // ============================================

        case ActionTypes.PREVIEW_STARTED: {
            const { targetDb, strategy, documentIds, rightSidebarState } = action.payload;
            return {
                ...state,
                preview: {
                    ...state.preview,
                    isPreviewMode: true,
                    isLoadingPreview: true,
                    previewConfig: { targetDb, strategy },
                    previewDocumentIds: new Set(documentIds),
                },
                ui: {
                    ...state.ui,
                    mode: UI_MODE.PREVIEW,
                    rightSidebarStateBeforePreview: rightSidebarState,
                    // Expand sidebar in preview mode to show file list (especially for multi-file)
                    rightSidebarCollapsed: false,
                },
            };
        }

        case ActionTypes.PREVIEW_GENERATED: {
            const { embeddingPreview } = action.payload;
            return {
                ...state,
                preview: {
                    ...state.preview,
                    isLoadingPreview: false,
                    embeddingPreview,
                },
            };
        }

        case ActionTypes.PREVIEW_FAILED: {
            const { rightSidebarState } = action.payload;
            return {
                ...state,
                preview: {
                    ...state.preview,
                    isPreviewMode: false,
                    isLoadingPreview: false,
                    embeddingPreview: null,
                    previewConfig: { targetDb: '', strategy: '' },
                    previewDocumentIds: new Set(),
                },
                ui: {
                    ...state.ui,
                    mode: UI_MODE.EDITING,
                    rightSidebarCollapsed: rightSidebarState,
                },
            };
        }

        case ActionTypes.PREVIEW_CANCELLED: {
            const { rightSidebarState } = action.payload;
            return {
                ...state,
                preview: {
                    ...state.preview,
                    isPreviewMode: false,
                    isLoadingPreview: false,
                    embeddingPreview: null,
                    previewConfig: { targetDb: '', strategy: '' },
                    previewDocumentIds: new Set(),
                },
                ui: {
                    ...state.ui,
                    mode: UI_MODE.EDITING,
                    rightSidebarCollapsed: rightSidebarState,
                },
            };
        }

        case ActionTypes.PREVIEW_FILE_SWITCHED: {
            const { documentId, embeddingPreview } = action.payload;
            return {
                ...state,
                fileQueue: {
                    ...state.fileQueue,
                    selectedDocumentId: documentId,
                },
                preview: {
                    ...state.preview,
                    isLoadingPreview: false,
                    embeddingPreview,
                },
            };
        }

        case ActionTypes.PREVIEW_FILE_REMOVED: {
            const { documentId } = action.payload;
            const newPreviewIds = new Set(state.preview.previewDocumentIds);
            newPreviewIds.delete(documentId);

            // If no files left, exit preview mode
            if (newPreviewIds.size === 0) {
                return {
                    ...state,
                    preview: {
                        ...state.preview,
                        isPreviewMode: false,
                        isLoadingPreview: false,
                        embeddingPreview: null,
                        previewConfig: { targetDb: '', strategy: '' },
                        previewDocumentIds: new Set(),
                    },
                    ui: {
                        ...state.ui,
                        mode: UI_MODE.EDITING,
                        rightSidebarCollapsed: state.ui.rightSidebarStateBeforePreview,
                    },
                };
            }

            return {
                ...state,
                preview: {
                    ...state.preview,
                    previewDocumentIds: newPreviewIds,
                },
            };
        }

        // ============================================
        // INGESTION ACTIONS (Cross-Domain)
        // ============================================

        case ActionTypes.INGESTION_STARTED: {
            return {
                ...state,
                ui: {
                    ...state.ui,
                    isIngesting: true,
                    ingestionProgress: 0,
                },
            };
        }

        case ActionTypes.INGESTION_PROGRESS: {
            const { progress } = action.payload;
            return {
                ...state,
                ui: {
                    ...state.ui,
                    ingestionProgress: progress,
                },
            };
        }

        case ActionTypes.INGESTION_COMPLETE: {
            const { ingestedEntry, ingestedData, rightSidebarState } = action.payload;

            // Update or add ingested entry (avoid duplicates)
            let updatedIngestedFiles = state.fileQueue.ingestedFiles;
            if (ingestedEntry) {
                const existingIndex = updatedIngestedFiles.findIndex(
                    f => f.ingestedId === ingestedEntry.ingestedId
                );
                if (existingIndex >= 0) {
                    // Update existing
                    updatedIngestedFiles = [
                        ...updatedIngestedFiles.slice(0, existingIndex),
                        ingestedEntry,
                        ...updatedIngestedFiles.slice(existingIndex + 1),
                    ];
                } else {
                    // Add new
                    updatedIngestedFiles = [...updatedIngestedFiles, ingestedEntry];
                }
            }

            return {
                ...state,
                fileQueue: {
                    ...state.fileQueue,
                    ingestedFiles: updatedIngestedFiles,
                    // Update selected to the ingested file ID
                    selectedDocumentId: ingestedEntry?.ingestedId || state.fileQueue.selectedDocumentId,
                },
                document: {
                    ...state.document,
                    contentType: CONTENT_TYPE.EMBEDDING,
                    storedEmbeddings: ingestedData,
                },
                preview: {
                    ...state.preview,
                    isPreviewMode: false,
                    isLoadingPreview: false,
                    embeddingPreview: null,
                    previewConfig: { targetDb: '', strategy: '' },
                    previewDocumentIds: new Set(),
                },
                ui: {
                    ...state.ui,
                    mode: UI_MODE.READONLY,
                    isIngesting: false,
                    ingestionProgress: 0,
                    rightSidebarCollapsed: rightSidebarState,
                },
            };
        }

        case ActionTypes.INGESTION_BATCH_COMPLETE: {
            const { ingestedEntries, rightSidebarState } = action.payload;

            // Add all ingested entries (avoid duplicates)
            let updatedIngestedFiles = [...state.fileQueue.ingestedFiles];
            for (const entry of ingestedEntries) {
                const existingIndex = updatedIngestedFiles.findIndex(
                    f => f.ingestedId === entry.ingestedId
                );
                if (existingIndex >= 0) {
                    // Update existing
                    updatedIngestedFiles[existingIndex] = entry;
                } else {
                    // Add new
                    updatedIngestedFiles.push(entry);
                }
            }

            // Select the first ingested file
            const firstEntry = ingestedEntries[0];

            return {
                ...state,
                fileQueue: {
                    ...state.fileQueue,
                    ingestedFiles: updatedIngestedFiles,
                    selectedDocumentId: firstEntry?.ingestedId || state.fileQueue.selectedDocumentId,
                },
                document: {
                    ...state.document,
                    contentType: CONTENT_TYPE.EMBEDDING,
                    storedEmbeddings: firstEntry?.embeddingPreview || null,
                },
                preview: {
                    ...state.preview,
                    isPreviewMode: false,
                    isLoadingPreview: false,
                    embeddingPreview: null,
                    previewConfig: { targetDb: '', strategy: '' },
                    previewDocumentIds: new Set(),
                },
                ui: {
                    ...state.ui,
                    mode: UI_MODE.READONLY,
                    isIngesting: false,
                    ingestionProgress: 0,
                    rightSidebarCollapsed: rightSidebarState,
                    multiSelectMode: false,
                    checkedDocumentIds: new Set(),
                },
            };
        }

        case ActionTypes.INGESTION_FAILED: {
            return {
                ...state,
                ui: {
                    ...state.ui,
                    isIngesting: false,
                    ingestionProgress: 0,
                },
            };
        }

        // ============================================
        // UI ACTIONS
        // ============================================

        case ActionTypes.LEFT_SIDEBAR_TOGGLED: {
            return {
                ...state,
                ui: {
                    ...state.ui,
                    leftSidebarCollapsed: !state.ui.leftSidebarCollapsed,
                },
            };
        }

        case ActionTypes.RIGHT_SIDEBAR_TOGGLED: {
            return {
                ...state,
                ui: {
                    ...state.ui,
                    rightSidebarCollapsed: !state.ui.rightSidebarCollapsed,
                },
            };
        }

        case ActionTypes.MULTI_SELECT_TOGGLED: {
            const newMode = !state.ui.multiSelectMode;
            return {
                ...state,
                ui: {
                    ...state.ui,
                    multiSelectMode: newMode,
                    // Clear checked documents when exiting multi-select
                    checkedDocumentIds: newMode ? state.ui.checkedDocumentIds : new Set(),
                },
            };
        }

        case ActionTypes.DOCUMENT_CHECKED: {
            const { documentId } = action.payload;
            const newChecked = new Set(state.ui.checkedDocumentIds);
            if (newChecked.has(documentId)) {
                newChecked.delete(documentId);
            } else {
                newChecked.add(documentId);
            }
            return {
                ...state,
                ui: {
                    ...state.ui,
                    checkedDocumentIds: newChecked,
                },
            };
        }

        case ActionTypes.CHECKED_DOCUMENTS_CLEARED: {
            return {
                ...state,
                ui: {
                    ...state.ui,
                    checkedDocumentIds: new Set(),
                },
            };
        }

        case ActionTypes.DRAGGING_CHANGED: {
            const { isDragging } = action.payload;
            return {
                ...state,
                ui: {
                    ...state.ui,
                    isDragging,
                },
            };
        }

        // ============================================
        // MODAL ACTIONS
        // ============================================

        case ActionTypes.MODAL_OPENED: {
            const { modalType } = action.payload;
            return {
                ...state,
                ui: {
                    ...state.ui,
                    activeModal: modalType,
                },
            };
        }

        case ActionTypes.MODAL_CLOSED: {
            return {
                ...state,
                ui: {
                    ...state.ui,
                    activeModal: null,
                },
            };
        }

        // ============================================
        // HELPER ACTIONS
        // ============================================

        case ActionTypes.HELPER_STARTED: {
            const { helperId } = action.payload;
            return {
                ...state,
                ui: {
                    ...state.ui,
                    runningHelper: helperId,
                },
            };
        }

        case ActionTypes.HELPER_COMPLETED: {
            return {
                ...state,
                ui: {
                    ...state.ui,
                    runningHelper: null,
                },
            };
        }

        case ActionTypes.HELPER_FAILED: {
            return {
                ...state,
                ui: {
                    ...state.ui,
                    runningHelper: null,
                },
            };
        }

        case ActionTypes.PENDING_HELPER_SET: {
            const { helper } = action.payload;
            return {
                ...state,
                ui: {
                    ...state.ui,
                    pendingHelper: helper,
                },
            };
        }

        case ActionTypes.PENDING_HELPER_CLEARED: {
            return {
                ...state,
                ui: {
                    ...state.ui,
                    pendingHelper: null,
                },
            };
        }

        default:
            console.warn(`[ingestionReducer] Unknown action type: ${action.type}`);
            return state;
    }
}

export default ingestionReducer;
