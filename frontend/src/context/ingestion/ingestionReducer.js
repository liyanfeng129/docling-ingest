/**
 * Ingestion Reducer (Refactored with Data Models)
 * 
 * Central state management for the Ingestion Page.
 * All state transitions are handled here for traceability.
 * 
 * State is split into domains using immutable data model classes:
 * - fileQueue: FileQueueModel - File upload queue and ingested files
 * - document: DocumentModel - Current document state and editing
 * - preview: PreviewModel - Embedding preview state
 * - ui: UIModel - UI state (sidebars, modals, modes)
 * 
 * REFACTORING: This reducer now delegates to model methods instead of
 * directly manipulating state objects. This provides:
 * - Type safety via class constructors
 * - Encapsulated business logic
 * - Immutability guarantees via Object.freeze()
 * - Self-documenting state structure
 * 
 * @see doc/ingestion/REDUCER.md for detailed documentation
 * @see doc/ingestion/REFACTORING_PLAN_DATA_MODELS.md for refactoring rationale
 * @see doc/ingestion/ADR.md ADR-002 for architectural decisions
 */

import * as ActionTypes from './actionTypes';
import { CONTENT_TYPE } from './constants';
import { FileQueueModel } from './models/FileQueueModel';
import { DocumentModel } from './models/DocumentModel';
import { PreviewModel } from './models/PreviewModel';
import { UIModel } from './models/UIModel';

/**
 * Initial state structure using model classes
 */
export const initialState = {
    fileQueue: FileQueueModel.empty(),
    document: DocumentModel.empty(),
    preview: PreviewModel.empty(),
    ui: UIModel.empty(),
};

/**
 * Main reducer function
 * 
 * Handles all state transitions atomically.
 * Cross-domain actions update multiple domains in a single dispatch.
 * Delegates to model setters for all state modifications.
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
                fileQueue: state.fileQueue.addUpload(id, file, filename),
            };
        }

        case ActionTypes.FILE_UPLOAD_PROGRESS: {
            const { id, status, progress } = action.payload;
            return {
                ...state,
                fileQueue: state.fileQueue.updateUploadProgress(id, status, progress),
            };
        }

        case ActionTypes.FILE_UPLOAD_COMPLETE: {
            const { id, documentId } = action.payload;
            return {
                ...state,
                fileQueue: state.fileQueue.completeUpload(id, documentId),
            };
        }

        case ActionTypes.FILE_UPLOAD_FAILED: {
            const { id, error } = action.payload;
            return {
                ...state,
                fileQueue: state.fileQueue.failUpload(id, error),
            };
        }

        case ActionTypes.FILE_SELECTED: {
            const { documentId } = action.payload;
            return {
                ...state,
                fileQueue: state.fileQueue.selectFile(documentId),
            };
        }

        case ActionTypes.FILE_REMOVED: {
            const { documentId } = action.payload;
            const wasSelected = state.fileQueue.selectedDocumentId === documentId;
            return {
                ...state,
                fileQueue: state.fileQueue.removeFile(documentId),
                document: wasSelected
                    ? state.document
                        .resetDocument()
                        .setContentType(CONTENT_TYPE.EDITOR)
                        .clearStoredEmbeddings()
                    : state.document,
            };
        }

        case ActionTypes.FILE_RENAMED: {
            const { documentId, newFilename } = action.payload;
            return {
                ...state,
                fileQueue: state.fileQueue.renameFile(documentId, newFilename),
            };
        }

        case ActionTypes.FILES_RESTORED_FROM_CACHE: {
            const { uploadQueue, ingestedFiles } = action.payload;
            const newFileQueue = state.fileQueue.restoreFromCache(uploadQueue, ingestedFiles);
            
            // Reset document state when clearing all files
            const shouldResetDocument = uploadQueue.length === 0;
            
            return {
                ...state,
                fileQueue: newFileQueue,
                document: shouldResetDocument
                    ? DocumentModel.empty()
                    : state.document,
            };
        }

        case ActionTypes.INGESTED_FILES_LOADED: {
            const { ingestedFiles } = action.payload;
            return {
                ...state,
                fileQueue: state.fileQueue.loadIngestedFiles(ingestedFiles),
            };
        }

        case ActionTypes.INGESTED_FILE_REMOVED: {
            const { ingestedId } = action.payload;
            const wasSelected = state.fileQueue.selectedDocumentId === ingestedId;
            return {
                ...state,
                fileQueue: state.fileQueue.removeIngestedFile(ingestedId),
                document: wasSelected
                    ? state.document
                        .clearStoredEmbeddings()
                        .setContentType(CONTENT_TYPE.EDITOR)
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
                fileQueue: state.fileQueue.selectFile(documentId),
                document: state.document.loadDocument(documentState, documentId),
            };
        }

        case ActionTypes.DOCUMENT_MODIFIED: {
            const { documentState } = action.payload;
            return {
                ...state,
                document: state.document.modifyDocument(documentState),
            };
        }

        case ActionTypes.DOCUMENT_RESET: {
            return {
                ...state,
                document: state.document.resetDocument(),
            };
        }

        case ActionTypes.PAGE_CHANGED: {
            const { page } = action.payload;
            return {
                ...state,
                document: state.document.changePage(page),
            };
        }

        case ActionTypes.CONTENT_TYPE_CHANGED: {
            const { contentType } = action.payload;
            return {
                ...state,
                document: state.document.setContentType(contentType),
            };
        }

        case ActionTypes.STORED_EMBEDDINGS_SET: {
            const { embeddings, documentId } = action.payload;
            return {
                ...state,
                fileQueue: state.fileQueue.selectFile(documentId),
                document: state.document.setStoredEmbeddings(embeddings, documentId),
            };
        }

        // ============================================
        // PREVIEW ACTIONS
        // ============================================

        case ActionTypes.PREVIEW_STARTED: {
            const { targetDb, strategy, documentIds, rightSidebarState } = action.payload;
            return {
                ...state,
                preview: state.preview.startPreview(targetDb, strategy, documentIds),
                ui: state.ui.enterPreviewMode(rightSidebarState),
            };
        }

        case ActionTypes.PREVIEW_GENERATED: {
            const { embeddingPreview } = action.payload;
            return {
                ...state,
                preview: state.preview.setPreviewGenerated(embeddingPreview),
            };
        }

        case ActionTypes.PREVIEW_FAILED: {
            const { rightSidebarState } = action.payload;
            return {
                ...state,
                preview: PreviewModel.empty(),
                ui: state.ui.exitPreviewMode().setRightSidebarCollapsed(rightSidebarState),
            };
        }

        case ActionTypes.PREVIEW_CANCELLED: {
            const { rightSidebarState } = action.payload;
            return {
                ...state,
                preview: state.preview.cancel(),
                ui: state.ui.exitPreviewMode().setRightSidebarCollapsed(rightSidebarState),
            };
        }

        case ActionTypes.PREVIEW_FILE_SWITCHED: {
            const { documentId, embeddingPreview } = action.payload;
            return {
                ...state,
                fileQueue: state.fileQueue.selectFile(documentId),
                preview: state.preview.switchFile(documentId, embeddingPreview),
            };
        }

        case ActionTypes.PREVIEW_FILE_REMOVED: {
            const { documentId } = action.payload;
            const newPreview = state.preview.removeDocument(documentId);
            
            // If preview becomes empty (no more documents), exit preview mode
            if (!newPreview.isActive) {
                return {
                    ...state,
                    preview: newPreview,
                    ui: state.ui.exitPreviewMode(),
                };
            }

            return {
                ...state,
                preview: newPreview,
            };
        }

        // ============================================
        // INGESTION ACTIONS (Cross-Domain)
        // ============================================

        case ActionTypes.INGESTION_STARTED: {
            return {
                ...state,
                ui: state.ui.startIngestion(),
            };
        }

        case ActionTypes.INGESTION_PROGRESS: {
            const { progress } = action.payload;
            return {
                ...state,
                ui: state.ui.setIngestionProgress(progress),
            };
        }

        case ActionTypes.INGESTION_COMPLETE: {
            const { ingestedEntry, ingestedData, rightSidebarState } = action.payload;

            return {
                ...state,
                fileQueue: state.fileQueue
                    .addIngestedFile(ingestedEntry)
                    .selectFile(ingestedEntry?.ingestedId),
                document: state.document.setStoredEmbeddings(ingestedData),
                preview: PreviewModel.empty(),
                ui: state.ui
                    .enterReadonlyMode()
                    .setRightSidebarCollapsed(rightSidebarState),
            };
        }

        case ActionTypes.INGESTION_BATCH_COMPLETE: {
            const { ingestedEntries, rightSidebarState } = action.payload;

            // Select the first ingested file
            const firstEntry = ingestedEntries[0];

            return {
                ...state,
                fileQueue: state.fileQueue
                    .addIngestedFiles(ingestedEntries)
                    .selectFile(firstEntry?.ingestedId),
                document: state.document.setStoredEmbeddings(firstEntry?.embeddingPreview || null),
                preview: PreviewModel.empty(),
                ui: state.ui.completeBatchIngestion(rightSidebarState),
            };
        }

        case ActionTypes.INGESTION_FAILED: {
            return {
                ...state,
                ui: state.ui.failIngestion(),
            };
        }

        // ============================================
        // UI ACTIONS
        // ============================================

        case ActionTypes.LEFT_SIDEBAR_TOGGLED: {
            return {
                ...state,
                ui: state.ui.toggleLeftSidebar(),
            };
        }

        case ActionTypes.RIGHT_SIDEBAR_TOGGLED: {
            return {
                ...state,
                ui: state.ui.toggleRightSidebar(),
            };
        }

        case ActionTypes.MULTI_SELECT_TOGGLED: {
            return {
                ...state,
                ui: state.ui.toggleMultiSelect(),
            };
        }

        case ActionTypes.DOCUMENT_CHECKED: {
            const { documentId } = action.payload;
            return {
                ...state,
                ui: state.ui.toggleDocumentChecked(documentId),
            };
        }

        case ActionTypes.CHECKED_DOCUMENTS_CLEARED: {
            return {
                ...state,
                ui: state.ui.clearCheckedDocuments(),
            };
        }

        case ActionTypes.DRAGGING_CHANGED: {
            const { isDragging } = action.payload;
            return {
                ...state,
                ui: state.ui.setDragging(isDragging),
            };
        }

        // ============================================
        // MODAL ACTIONS
        // ============================================

        case ActionTypes.MODAL_OPENED: {
            const { modalType } = action.payload;
            return {
                ...state,
                ui: state.ui.openModal(modalType),
            };
        }

        case ActionTypes.MODAL_CLOSED: {
            return {
                ...state,
                ui: state.ui.closeModal(),
            };
        }

        // ============================================
        // HELPER ACTIONS
        // ============================================

        case ActionTypes.HELPER_STARTED: {
            const { helperId } = action.payload;
            return {
                ...state,
                ui: state.ui.startHelper(helperId),
            };
        }

        case ActionTypes.HELPER_COMPLETED: {
            return {
                ...state,
                ui: state.ui.completeHelper(),
            };
        }

        case ActionTypes.HELPER_FAILED: {
            return {
                ...state,
                ui: state.ui.failHelper(),
            };
        }

        case ActionTypes.PENDING_HELPER_SET: {
            const { helper } = action.payload;
            return {
                ...state,
                ui: state.ui.setPendingHelper(helper),
            };
        }

        case ActionTypes.PENDING_HELPER_CLEARED: {
            return {
                ...state,
                ui: state.ui.clearPendingHelper(),
            };
        }

        default:
            console.warn(`[ingestionReducer] Unknown action type: ${action.type}`);
            return state;
    }
}

export default ingestionReducer;
