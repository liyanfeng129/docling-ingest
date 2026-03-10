/**
 * PreviewModel - Domain model for embedding preview state
 * 
 * This model encapsulates:
 * - Preview mode state (active/inactive)
 * - Loading state for preview generation
 * - Preview configuration (target DB, strategy)
 * - Multi-file preview support
 * 
 * @see doc/ingestion/REFACTORING_PLAN_DATA_MODELS.md
 */

/**
 * Preview Configuration
 */
export class PreviewConfig {
    /**
     * @param {Object} data
     * @param {string} [data.targetDb] - Target database name
     * @param {string} [data.strategy] - Ingestion strategy
     */
    constructor({ targetDb = '', strategy = '' } = {}) {
        this.targetDb = targetDb;
        this.strategy = strategy;
        Object.freeze(this);
    }

    get isValid() {
        return this.targetDb.length > 0 && this.strategy.length > 0;
    }

    get isEmpty() {
        return this.targetDb.length === 0 && this.strategy.length === 0;
    }

    withTargetDb(targetDb) {
        return new PreviewConfig({ ...this, targetDb });
    }

    withStrategy(strategy) {
        return new PreviewConfig({ ...this, strategy });
    }

    toJSON() {
        return { targetDb: this.targetDb, strategy: this.strategy };
    }

    static fromJSON(json) {
        return new PreviewConfig(json);
    }

    static empty() {
        return new PreviewConfig({});
    }
}

/**
 * Preview Domain Model
 * Manages embedding preview state before ingestion
 */
export class PreviewModel {
    /**
     * @param {Object} data
     * @param {boolean} [data.isPreviewMode] - Whether preview mode is active
     * @param {boolean} [data.isLoadingPreview] - Whether preview is being generated
     * @param {Object|null} [data.embeddingPreview] - Preview data from API
     * @param {Object|PreviewConfig} [data.previewConfig] - Preview configuration
     * @param {Set|Array} [data.previewDocumentIds] - Document IDs in current preview
     */
    constructor({
        isPreviewMode = false,
        isLoadingPreview = false,
        embeddingPreview = null,
        previewConfig = {},
        previewDocumentIds = new Set(),
    } = {}) {
        this.isPreviewMode = isPreviewMode;
        this.isLoadingPreview = isLoadingPreview;
        this.embeddingPreview = embeddingPreview;
        this.previewConfig = previewConfig instanceof PreviewConfig
            ? previewConfig
            : new PreviewConfig(previewConfig);
        this.previewDocumentIds = previewDocumentIds instanceof Set
            ? previewDocumentIds
            : new Set(previewDocumentIds);
        Object.freeze(this);
    }

    // ============ STATE GETTERS ============

    get isActive() {
        return this.isPreviewMode;
    }

    get isLoading() {
        return this.isLoadingPreview;
    }

    get hasPreview() {
        return this.embeddingPreview !== null;
    }

    get isReady() {
        return this.isActive && this.hasPreview && !this.isLoading;
    }

    // ============ CONFIG GETTERS ============

    get targetDb() {
        return this.previewConfig.targetDb;
    }

    get strategy() {
        return this.previewConfig.strategy;
    }

    get hasValidConfig() {
        return this.previewConfig.isValid;
    }

    // ============ DOCUMENT GETTERS ============

    get isMultiFile() {
        return this.previewDocumentIds.size > 1;
    }

    get isSingleFile() {
        return this.previewDocumentIds.size === 1;
    }

    get documentCount() {
        return this.previewDocumentIds.size;
    }

    get documentIds() {
        return Array.from(this.previewDocumentIds);
    }

    hasDocument(documentId) {
        return this.previewDocumentIds.has(documentId);
    }

    // ============ PREVIEW LIFECYCLE SETTERS ============

    startPreview(targetDb, strategy, documentIds) {
        return new PreviewModel({
            ...this,
            isPreviewMode: true,
            isLoadingPreview: true,
            embeddingPreview: null,
            previewConfig: new PreviewConfig({ targetDb, strategy }),
            previewDocumentIds: new Set(documentIds),
        });
    }

    setPreviewGenerated(embeddingPreview) {
        return new PreviewModel({
            ...this,
            isLoadingPreview: false,
            embeddingPreview,
        });
    }

    setPreviewLoading(isLoading) {
        return new PreviewModel({
            ...this,
            isLoadingPreview: isLoading,
        });
    }

    setPreviewFailed() {
        return PreviewModel.empty();
    }

    // ============ DOCUMENT MANAGEMENT SETTERS ============

    removeDocument(documentId) {
        const newIds = new Set(this.previewDocumentIds);
        newIds.delete(documentId);

        // If no documents left, reset to empty
        if (newIds.size === 0) {
            return PreviewModel.empty();
        }

        return new PreviewModel({
            ...this,
            previewDocumentIds: newIds,
        });
    }

    addDocument(documentId) {
        const newIds = new Set(this.previewDocumentIds);
        newIds.add(documentId);

        return new PreviewModel({
            ...this,
            previewDocumentIds: newIds,
        });
    }

    // ============ PREVIEW FILE SWITCHING ============

    switchFile(documentId, embeddingPreview) {
        return new PreviewModel({
            ...this,
            isLoadingPreview: false,
            embeddingPreview,
        });
    }

    // ============ CANCEL/RESET ============

    cancel() {
        return PreviewModel.empty();
    }

    reset() {
        return PreviewModel.empty();
    }

    // ============ SERIALIZATION ============

    toJSON() {
        return {
            isPreviewMode: this.isPreviewMode,
            isLoadingPreview: this.isLoadingPreview,
            embeddingPreview: this.embeddingPreview,
            previewConfig: this.previewConfig.toJSON(),
            previewDocumentIds: Array.from(this.previewDocumentIds),
        };
    }

    static fromJSON(json) {
        return new PreviewModel({
            ...json,
            previewDocumentIds: new Set(json.previewDocumentIds || []),
        });
    }

    static empty() {
        return new PreviewModel({});
    }
}

export default PreviewModel;
