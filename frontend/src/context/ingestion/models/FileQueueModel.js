/**
 * FileQueueModel - Domain model for file upload queue and ingested files
 * 
 * This model encapsulates:
 * - Upload queue items with typed properties
 * - Ingested file items with canonical identifiers
 * - File selection state
 * 
 * @see doc/ingestion/REFACTORING_PLAN_DATA_MODELS.md
 */

import { DOC_STATUS } from '../constants';

/**
 * Represents a file in the upload queue
 */
export class UploadQueueItem {
    /**
     * @param {Object} data
     * @param {string} data.id - Unique upload ID (UUID)
     * @param {string|null} [data.documentId] - Document ID after processing (null if pending)
     * @param {string} data.filename - Original filename
     * @param {string} data.status - One of DOC_STATUS values
     * @param {number} [data.progress] - Upload progress 0-100
     * @param {string|null} [data.error] - Error message if failed
     * @param {File} [data.file] - Original file object (optional, for re-upload)
     */
    constructor({ id, documentId = null, filename, status, progress = 0, error = null, file = null }) {
        if (!id) {
            throw new Error('UploadQueueItem requires id');
        }
        if (!filename) {
            throw new Error('UploadQueueItem requires filename');
        }
        if (!status) {
            throw new Error('UploadQueueItem requires status');
        }

        this.id = id;
        this.documentId = documentId;
        this.filename = filename;
        this.status = status;
        this.progress = progress;
        this.error = error;
        this.file = file;
        Object.freeze(this);
    }

    // ============ STATUS GETTERS ============

    get isReady() {
        return this.status === DOC_STATUS.READY;
    }

    get isUploading() {
        return this.status === DOC_STATUS.UPLOADING;
    }

    get isProcessing() {
        return this.status === DOC_STATUS.PROCESSING;
    }

    get isQueued() {
        return this.status === DOC_STATUS.QUEUED;
    }

    get hasError() {
        return this.status === DOC_STATUS.ERROR;
    }

    get isPending() {
        return this.isQueued || this.isUploading || this.isProcessing;
    }

    // ============ DISPLAY GETTERS ============

    get displayName() {
        return this.filename.replace(/\.[^/.]+$/, ''); // Remove extension
    }

    get extension() {
        const match = this.filename.match(/\.([^/.]+)$/);
        return match ? match[1].toLowerCase() : '';
    }

    // ============ SETTERS (return new instance) ============

    withProgress(status, progress) {
        return new UploadQueueItem({
            ...this,
            status,
            progress,
        });
    }

    withComplete(documentId) {
        return new UploadQueueItem({
            ...this,
            documentId,
            status: DOC_STATUS.READY,
            progress: 100,
        });
    }

    withError(error) {
        return new UploadQueueItem({
            ...this,
            status: DOC_STATUS.ERROR,
            error,
        });
    }

    withFilename(newFilename) {
        return new UploadQueueItem({
            ...this,
            filename: newFilename,
        });
    }

    // ============ SERIALIZATION ============

    toJSON() {
        return {
            id: this.id,
            documentId: this.documentId,
            filename: this.filename,
            status: this.status,
            progress: this.progress,
            error: this.error,
            // Note: file object is not serialized
        };
    }

    static fromJSON(json) {
        return new UploadQueueItem(json);
    }
}

/**
 * Represents an ingested file
 * 
 * SOLVES: The "which field do I use?" problem
 * 
 * Before (component code):
 *   key={doc.ingestedId || doc.id || doc.documentId}  // Guessing!
 *   documentId: doc.ingestedId || doc.documentId      // More guessing!
 * 
 * After (with this model):
 *   key={doc.id}           // Always use .id
 *   documentId: doc.id     // .id is the canonical identifier
 */
export class IngestedFileItem {
    /**
     * @param {Object} data
     * @param {string} data.ingestedId - Unique ingested ID (REQUIRED)
     * @param {string} [data.documentId] - Original document ID before ingestion
     * @param {string} data.filename - Filename (REQUIRED)
     * @param {string} [data.strategy] - Ingestion strategy used
     * @param {string} [data.targetDb] - Target database
     * @param {number} [data.timestamp] - Ingestion timestamp
     * @param {number} [data.embeddingCount] - Number of embeddings created
     * @param {Object} [data.embeddingPreview] - Preview data (optional, for display)
     */
    constructor({
        ingestedId,
        documentId,
        filename,
        strategy,
        targetDb,
        timestamp,
        embeddingCount = 0,
        embeddingPreview = null,
    }) {
        // Validate required fields
        if (!ingestedId) {
            throw new Error('IngestedFileItem requires ingestedId');
        }
        if (!filename) {
            throw new Error('IngestedFileItem requires filename');
        }

        this.ingestedId = ingestedId;
        this.documentId = documentId || ingestedId; // Fallback for compatibility
        this.filename = filename;
        this.strategy = strategy || 'unknown';
        this.targetDb = targetDb || 'unknown';
        this.timestamp = timestamp || Date.now();
        this.embeddingCount = embeddingCount;
        this.embeddingPreview = embeddingPreview;
        Object.freeze(this);
    }

    // ============ CANONICAL IDENTIFIERS ============
    // Components should ALWAYS use these, never raw field access

    /**
     * The canonical unique identifier for this item.
     * Use this for React keys and selection comparisons.
     */
    get id() {
        return this.ingestedId;
    }

    /**
     * The status is always 'ingested' for IngestedFileItem
     */
    get status() {
        return 'ingested';
    }

    // ============ DISPLAY GETTERS ============

    get displayName() {
        return this.filename.replace(/\.[^/.]+$/, '');
    }

    get extension() {
        const match = this.filename.match(/\.([^/.]+)$/);
        return match ? match[1].toLowerCase() : '';
    }

    get formattedDate() {
        return new Date(this.timestamp).toLocaleDateString();
    }

    get formattedDateTime() {
        return new Date(this.timestamp).toLocaleString();
    }

    // ============ COMPONENT HELPER ============

    /**
     * Returns props ready for FileQueueItem component.
     * Eliminates the need for inline object transformation.
     * 
     * Before (in component):
     *   doc={{
     *       ...doc,
     *       id: doc.ingestedId || doc.id || doc.documentId,
     *       documentId: doc.ingestedId || doc.documentId,
     *       status: 'ingested'
     *   }}
     * 
     * After:
     *   doc={doc.toFileQueueItemProps()}
     */
    toFileQueueItemProps() {
        return {
            id: this.id,
            documentId: this.id,
            filename: this.filename,
            status: this.status,
            strategy: this.strategy,
            targetDb: this.targetDb,
            timestamp: this.timestamp,
            embeddingCount: this.embeddingCount,
        };
    }

    // ============ SERIALIZATION ============

    toJSON() {
        return {
            ingestedId: this.ingestedId,
            documentId: this.documentId,
            filename: this.filename,
            strategy: this.strategy,
            targetDb: this.targetDb,
            timestamp: this.timestamp,
            embeddingCount: this.embeddingCount,
            embeddingPreview: this.embeddingPreview,
        };
    }

    static fromJSON(json) {
        return new IngestedFileItem(json);
    }
}

/**
 * FileQueue Domain Model
 * Manages upload queue and ingested files
 */
export class FileQueueModel {
    /**
     * Internal constructor - accepts only typed arrays.
     * Use static factory methods for creating from plain objects.
     * 
     * @param {UploadQueueItem[]} uploadQueue - Array of UploadQueueItem instances
     * @param {IngestedFileItem[]} ingestedFiles - Array of IngestedFileItem instances  
     * @param {string|null} selectedDocumentId - Currently selected document ID
     */
    constructor(
        uploadQueue = [],
        ingestedFiles = [],
        selectedDocumentId = null,
    ) {
        // These are already typed - no conversion needed
        this.uploadQueue = uploadQueue;
        this.ingestedFiles = ingestedFiles;
        this.selectedDocumentId = selectedDocumentId;
        Object.freeze(this);
    }

    // ============ STATIC FACTORY METHODS ============

    /**
     * Create from plain objects (e.g., from localStorage or API)
     */
    static fromJSON(json) {
        const uploadQueue = (json.uploadQueue || []).map(item =>
            item instanceof UploadQueueItem ? item : new UploadQueueItem(item)
        );
        const ingestedFiles = (json.ingestedFiles || []).map(item =>
            item instanceof IngestedFileItem ? item : new IngestedFileItem(item)
        );
        return new FileQueueModel(
            uploadQueue,
            ingestedFiles,
            json.selectedDocumentId || null,
        );
    }

    /**
     * Create empty model
     */
    static empty() {
        return new FileQueueModel([], [], null);
    }

    // ============ INTERNAL HELPER ============

    /**
     * Create a new model preserving unchanged arrays (structural sharing)
     */
    _with(changes) {
        return new FileQueueModel(
            changes.uploadQueue !== undefined ? changes.uploadQueue : this.uploadQueue,
            changes.ingestedFiles !== undefined ? changes.ingestedFiles : this.ingestedFiles,
            changes.selectedDocumentId !== undefined ? changes.selectedDocumentId : this.selectedDocumentId,
        );
    }

    // ============ COMPUTED GETTERS ============

    get readyFiles() {
        return this.uploadQueue.filter(f => f.isReady);
    }

    get uploadingFiles() {
        return this.uploadQueue.filter(f => f.isPending);
    }

    get errorFiles() {
        return this.uploadQueue.filter(f => f.hasError);
    }

    get hasSelectedFile() {
        return this.selectedDocumentId !== null;
    }

    get selectedFile() {
        return this.getFileByDocumentId(this.selectedDocumentId)
            || this.getIngestedFileById(this.selectedDocumentId);
    }

    get isEmpty() {
        return this.uploadQueue.length === 0 && this.ingestedFiles.length === 0;
    }

    get uploadQueueCount() {
        return this.uploadQueue.length;
    }

    get ingestedFilesCount() {
        return this.ingestedFiles.length;
    }

    get readyCount() {
        return this.readyFiles.length;
    }

    // ============ LOOKUP METHODS ============

    getFileByDocumentId(documentId) {
        return this.uploadQueue.find(f => f.documentId === documentId) || null;
    }

    getFileByUploadId(uploadId) {
        return this.uploadQueue.find(f => f.id === uploadId) || null;
    }

    getIngestedFileById(ingestedId) {
        return this.ingestedFiles.find(f => f.ingestedId === ingestedId) || null;
    }

    isSelected(documentId) {
        return this.selectedDocumentId === documentId;
    }

    // ============ UPLOAD QUEUE SETTERS ============

    addUpload(id, file, filename) {
        const newItem = new UploadQueueItem({
            id,
            filename,
            status: DOC_STATUS.QUEUED,
            progress: 0,
            file,
        });
        return this._with({
            uploadQueue: [...this.uploadQueue, newItem],
        });
    }

    updateUploadProgress(id, status, progress) {
        return this._with({
            uploadQueue: this.uploadQueue.map(f =>
                f.id === id ? f.withProgress(status, progress) : f
            ),
        });
    }

    completeUpload(id, documentId) {
        return this._with({
            uploadQueue: this.uploadQueue.map(f =>
                f.id === id ? f.withComplete(documentId) : f
            ),
        });
    }

    failUpload(id, error) {
        return this._with({
            uploadQueue: this.uploadQueue.map(f =>
                f.id === id ? f.withError(error) : f
            ),
        });
    }

    selectFile(documentId) {
        // Only changes selectedDocumentId - arrays are preserved!
        return this._with({
            selectedDocumentId: documentId,
        });
    }

    removeFile(documentId) {
        const isSelected = this.selectedDocumentId === documentId;
        return this._with({
            uploadQueue: this.uploadQueue.filter(f => f.documentId !== documentId),
            selectedDocumentId: isSelected ? null : this.selectedDocumentId,
        });
    }

    renameFile(documentId, newFilename) {
        return this._with({
            uploadQueue: this.uploadQueue.map(f =>
                f.documentId === documentId ? f.withFilename(newFilename) : f
            ),
        });
    }

    // ============ INGESTED FILES SETTERS ============

    addIngestedFile(entry) {
        // Guard against null/undefined entries
        if (!entry) {
            console.warn('[FileQueueModel] addIngestedFile called with null entry');
            return this;
        }

        const item = entry instanceof IngestedFileItem
            ? entry
            : new IngestedFileItem(entry);

        // Check for existing (update) or new (add)
        const existingIndex = this.ingestedFiles.findIndex(
            f => f.ingestedId === item.ingestedId
        );

        let newIngestedFiles;
        if (existingIndex >= 0) {
            newIngestedFiles = [
                ...this.ingestedFiles.slice(0, existingIndex),
                item,
                ...this.ingestedFiles.slice(existingIndex + 1),
            ];
        } else {
            newIngestedFiles = [...this.ingestedFiles, item];
        }

        return this._with({
            ingestedFiles: newIngestedFiles,
        });
    }

    addIngestedFiles(entries) {
        let result = this;
        for (const entry of entries) {
            result = result.addIngestedFile(entry);
        }
        return result;
    }

    removeIngestedFile(ingestedId) {
        const isSelected = this.selectedDocumentId === ingestedId;
        return this._with({
            ingestedFiles: this.ingestedFiles.filter(f => f.ingestedId !== ingestedId),
            selectedDocumentId: isSelected ? null : this.selectedDocumentId,
        });
    }

    loadIngestedFiles(ingestedFiles) {
        return this._with({
            ingestedFiles: ingestedFiles.map(item =>
                item instanceof IngestedFileItem ? item : new IngestedFileItem(item)
            ),
        });
    }

    // ============ BATCH OPERATIONS ============

    restoreFromCache(uploadQueue, ingestedFiles = undefined) {
        const newUploadQueue = uploadQueue.map(item =>
            item instanceof UploadQueueItem ? item : new UploadQueueItem(item)
        );

        if (ingestedFiles !== undefined) {
            const newIngestedFiles = ingestedFiles.map(item =>
                item instanceof IngestedFileItem ? item : new IngestedFileItem(item)
            );
            return this._with({
                uploadQueue: newUploadQueue,
                ingestedFiles: newIngestedFiles,
            });
        }

        return this._with({
            uploadQueue: newUploadQueue,
        });
    }

    clearUploaded() {
        return this._with({
            uploadQueue: [],
            selectedDocumentId: null,
        });
    }

    clearIngested() {
        return this._with({
            ingestedFiles: [],
        });
    }

    clearAll() {
        return FileQueueModel.empty();
    }

    // ============ SERIALIZATION ============

    toJSON() {
        return {
            uploadQueue: this.uploadQueue.map(f => f.toJSON()),
            ingestedFiles: this.ingestedFiles.map(f => f.toJSON()),
            selectedDocumentId: this.selectedDocumentId,
        };
    }
}

export default FileQueueModel;
