/**
 * UIModel - Domain model for UI state
 * 
 * This model encapsulates:
 * - UI mode (editing, preview, readonly)
 * - Sidebar states
 * - Modal states
 * - Multi-select mode and checked documents
 * - Helper states (running, pending)
 * - Ingestion progress
 * 
 * @see doc/ingestion/REFACTORING_PLAN_DATA_MODELS.md
 */

import { UI_MODE, MODAL_TYPES } from '../constants';

/**
 * UI Domain Model
 */
export class UIModel {
    /**
     * @param {Object} data
     * @param {string} [data.mode] - UI mode: 'editing' | 'preview' | 'readonly'
     * @param {boolean} [data.leftSidebarCollapsed] - Left sidebar collapsed state
     * @param {boolean} [data.rightSidebarCollapsed] - Right sidebar collapsed state
     * @param {boolean} [data.rightSidebarStateBeforePreview] - Stored state before preview
     * @param {boolean} [data.isDragging] - Drag state for upload zone
     * @param {boolean} [data.multiSelectMode] - Multi-select mode active
     * @param {Set|Array} [data.checkedDocumentIds] - Checked document IDs
     * @param {boolean} [data.isEditingTitle] - Title editing state
     * @param {string} [data.editingTitleValue] - Current title value being edited
     * @param {boolean} [data.isIngesting] - Ingestion in progress
     * @param {number} [data.ingestionProgress] - Ingestion progress 0-100
     * @param {string|null} [data.runningHelper] - Currently running helper ID
     * @param {Object|null} [data.pendingHelper] - Helper waiting for file selection
     * @param {string|null} [data.activeModal] - Currently open modal type
     */
    constructor({
        mode = UI_MODE.EDITING,
        leftSidebarCollapsed = false,
        rightSidebarCollapsed = false,
        rightSidebarStateBeforePreview = false,
        isDragging = false,
        multiSelectMode = false,
        checkedDocumentIds = new Set(),
        isEditingTitle = false,
        editingTitleValue = '',
        isIngesting = false,
        ingestionProgress = 0,
        runningHelper = null,
        pendingHelper = null,
        activeModal = null,
    } = {}) {
        this.mode = mode;
        this.leftSidebarCollapsed = leftSidebarCollapsed;
        this.rightSidebarCollapsed = rightSidebarCollapsed;
        this.rightSidebarStateBeforePreview = rightSidebarStateBeforePreview;
        this.isDragging = isDragging;
        this.multiSelectMode = multiSelectMode;
        this.checkedDocumentIds = checkedDocumentIds instanceof Set
            ? checkedDocumentIds
            : new Set(checkedDocumentIds);
        this.isEditingTitle = isEditingTitle;
        this.editingTitleValue = editingTitleValue;
        this.isIngesting = isIngesting;
        this.ingestionProgress = ingestionProgress;
        this.runningHelper = runningHelper;
        this.pendingHelper = pendingHelper;
        this.activeModal = activeModal;
        Object.freeze(this);
    }

    // ============ MODE GETTERS ============

    get isEditingMode() {
        return this.mode === UI_MODE.EDITING;
    }

    get isPreviewMode() {
        return this.mode === UI_MODE.PREVIEW;
    }

    get isReadonlyMode() {
        return this.mode === UI_MODE.READONLY;
    }

    // ============ SIDEBAR GETTERS ============

    get isLeftSidebarOpen() {
        return !this.leftSidebarCollapsed;
    }

    get isRightSidebarOpen() {
        return !this.rightSidebarCollapsed;
    }

    // ============ MODAL GETTERS ============

    get hasActiveModal() {
        return this.activeModal !== null;
    }

    isModalOpen(modalType) {
        return this.activeModal === modalType;
    }

    get isIngestModalOpen() {
        return this.activeModal === MODAL_TYPES.INGEST;
    }

    get isRegexModalOpen() {
        return this.activeModal === MODAL_TYPES.REGEX;
    }

    get isCacheModalOpen() {
        return this.activeModal === MODAL_TYPES.CACHE_MANAGEMENT;
    }

    get isHelperFileSelectModalOpen() {
        return this.activeModal === MODAL_TYPES.HELPER_FILE_SELECT;
    }

    // ============ MULTI-SELECT GETTERS ============

    get checkedCount() {
        return this.checkedDocumentIds.size;
    }

    get hasCheckedDocuments() {
        return this.checkedDocumentIds.size > 0;
    }

    get checkedIds() {
        return Array.from(this.checkedDocumentIds);
    }

    isDocumentChecked(documentId) {
        return this.checkedDocumentIds.has(documentId);
    }

    // ============ HELPER GETTERS ============

    get isHelperRunning() {
        return this.runningHelper !== null;
    }

    get hasPendingHelper() {
        return this.pendingHelper !== null;
    }

    // ============ INGESTION GETTERS ============

    get isIngestionInProgress() {
        return this.isIngesting;
    }

    get ingestionProgressPercent() {
        return Math.min(100, Math.max(0, this.ingestionProgress));
    }

    // ============ MODE SETTERS ============

    setMode(mode) {
        return new UIModel({ ...this, mode });
    }

    // ============ SIDEBAR SETTERS ============

    toggleLeftSidebar() {
        return new UIModel({
            ...this,
            leftSidebarCollapsed: !this.leftSidebarCollapsed,
        });
    }

    toggleRightSidebar() {
        return new UIModel({
            ...this,
            rightSidebarCollapsed: !this.rightSidebarCollapsed,
        });
    }

    setLeftSidebarCollapsed(collapsed) {
        return new UIModel({
            ...this,
            leftSidebarCollapsed: collapsed,
        });
    }

    setRightSidebarCollapsed(collapsed) {
        return new UIModel({
            ...this,
            rightSidebarCollapsed: collapsed,
        });
    }

    saveRightSidebarState() {
        return new UIModel({
            ...this,
            rightSidebarStateBeforePreview: this.rightSidebarCollapsed,
        });
    }

    restoreRightSidebarState() {
        return new UIModel({
            ...this,
            rightSidebarCollapsed: this.rightSidebarStateBeforePreview,
        });
    }

    // ============ DRAG SETTERS ============

    setDragging(isDragging) {
        return new UIModel({ ...this, isDragging });
    }

    // ============ MULTI-SELECT SETTERS ============

    toggleMultiSelect() {
        const newMode = !this.multiSelectMode;
        return new UIModel({
            ...this,
            multiSelectMode: newMode,
            // Clear checked documents when exiting multi-select
            checkedDocumentIds: newMode ? this.checkedDocumentIds : new Set(),
        });
    }

    setMultiSelectMode(enabled) {
        return new UIModel({
            ...this,
            multiSelectMode: enabled,
            checkedDocumentIds: enabled ? this.checkedDocumentIds : new Set(),
        });
    }

    toggleDocumentChecked(documentId) {
        const newChecked = new Set(this.checkedDocumentIds);
        if (newChecked.has(documentId)) {
            newChecked.delete(documentId);
        } else {
            newChecked.add(documentId);
        }
        return new UIModel({
            ...this,
            checkedDocumentIds: newChecked,
        });
    }

    checkDocument(documentId) {
        const newChecked = new Set(this.checkedDocumentIds);
        newChecked.add(documentId);
        return new UIModel({
            ...this,
            checkedDocumentIds: newChecked,
        });
    }

    uncheckDocument(documentId) {
        const newChecked = new Set(this.checkedDocumentIds);
        newChecked.delete(documentId);
        return new UIModel({
            ...this,
            checkedDocumentIds: newChecked,
        });
    }

    clearCheckedDocuments() {
        return new UIModel({
            ...this,
            checkedDocumentIds: new Set(),
        });
    }

    // ============ TITLE EDITING SETTERS ============

    startTitleEditing(value) {
        return new UIModel({
            ...this,
            isEditingTitle: true,
            editingTitleValue: value,
        });
    }

    endTitleEditing() {
        return new UIModel({
            ...this,
            isEditingTitle: false,
            editingTitleValue: '',
        });
    }

    updateEditingTitleValue(value) {
        return new UIModel({
            ...this,
            editingTitleValue: value,
        });
    }

    // ============ INGESTION SETTERS ============

    startIngestion() {
        return new UIModel({
            ...this,
            isIngesting: true,
            ingestionProgress: 0,
        });
    }

    setIngestionProgress(progress) {
        return new UIModel({
            ...this,
            ingestionProgress: progress,
        });
    }

    completeIngestion() {
        return new UIModel({
            ...this,
            isIngesting: false,
            ingestionProgress: 0,
        });
    }

    failIngestion() {
        return new UIModel({
            ...this,
            isIngesting: false,
            ingestionProgress: 0,
        });
    }

    // ============ HELPER SETTERS ============

    startHelper(helperId) {
        return new UIModel({
            ...this,
            runningHelper: helperId,
        });
    }

    completeHelper() {
        return new UIModel({
            ...this,
            runningHelper: null,
        });
    }

    failHelper() {
        return new UIModel({
            ...this,
            runningHelper: null,
        });
    }

    setPendingHelper(helper) {
        return new UIModel({
            ...this,
            pendingHelper: helper,
        });
    }

    clearPendingHelper() {
        return new UIModel({
            ...this,
            pendingHelper: null,
        });
    }

    // ============ MODAL SETTERS ============

    openModal(modalType) {
        return new UIModel({
            ...this,
            activeModal: modalType,
        });
    }

    closeModal() {
        return new UIModel({
            ...this,
            activeModal: null,
        });
    }

    // ============ COMPOUND OPERATIONS ============

    /**
     * Enter preview mode - saves sidebar state and expands it
     * @param {boolean} currentRightSidebarState - Current right sidebar collapsed state
     */
    enterPreviewMode(currentRightSidebarState) {
        return new UIModel({
            ...this,
            mode: UI_MODE.PREVIEW,
            rightSidebarStateBeforePreview: currentRightSidebarState,
            rightSidebarCollapsed: false, // Expand for preview
        });
    }

    /**
     * Exit preview mode - restores sidebar state
     */
    exitPreviewMode() {
        return new UIModel({
            ...this,
            mode: UI_MODE.EDITING,
            rightSidebarCollapsed: this.rightSidebarStateBeforePreview,
        });
    }

    /**
     * Enter readonly mode after ingestion
     */
    enterReadonlyMode() {
        return new UIModel({
            ...this,
            mode: UI_MODE.READONLY,
            isIngesting: false,
            ingestionProgress: 0,
        });
    }

    /**
     * Exit readonly mode and return to editing
     */
    exitReadonlyMode() {
        return new UIModel({
            ...this,
            mode: UI_MODE.EDITING,
        });
    }

    /**
     * Complete batch ingestion - resets multi-select and enters readonly
     * @param {boolean} rightSidebarState - Right sidebar state to restore
     */
    completeBatchIngestion(rightSidebarState) {
        return new UIModel({
            ...this,
            mode: UI_MODE.READONLY,
            isIngesting: false,
            ingestionProgress: 0,
            rightSidebarCollapsed: rightSidebarState,
            multiSelectMode: false,
            checkedDocumentIds: new Set(),
        });
    }

    // ============ SERIALIZATION ============

    toJSON() {
        return {
            mode: this.mode,
            leftSidebarCollapsed: this.leftSidebarCollapsed,
            rightSidebarCollapsed: this.rightSidebarCollapsed,
            rightSidebarStateBeforePreview: this.rightSidebarStateBeforePreview,
            isDragging: this.isDragging,
            multiSelectMode: this.multiSelectMode,
            checkedDocumentIds: Array.from(this.checkedDocumentIds),
            isEditingTitle: this.isEditingTitle,
            editingTitleValue: this.editingTitleValue,
            isIngesting: this.isIngesting,
            ingestionProgress: this.ingestionProgress,
            runningHelper: this.runningHelper,
            pendingHelper: this.pendingHelper,
            activeModal: this.activeModal,
        };
    }

    static fromJSON(json) {
        return new UIModel({
            ...json,
            checkedDocumentIds: new Set(json.checkedDocumentIds || []),
        });
    }

    static empty() {
        return new UIModel({});
    }
}

export default UIModel;
