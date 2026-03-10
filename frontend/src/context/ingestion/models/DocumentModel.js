/**
 * DocumentModel - Domain model for document content and editing state
 * 
 * This model encapsulates:
 * - Document state with pages and items
 * - Page navigation with bounds checking
 * - Content type (editor vs embedding view)
 * - Item lookups and modifications
 * 
 * @see doc/ingestion/REFACTORING_PLAN_DATA_MODELS.md
 */

import { CONTENT_TYPE } from '../constants';

/**
 * Document Item (text, image, table)
 */
export class DocumentItem {
    /**
     * @param {Object} data
     * @param {string} data.id - Unique item ID
     * @param {string} data.type - Item type: 'text' | 'image' | 'picture' | 'table'
     * @param {string} [data.content] - Text content
     * @param {string} [data.classification] - Image classification
     * @param {string} [data.imageUrl] - Image URL
     * @param {boolean} [data.deleted] - Soft delete flag
     */
    constructor({ id, type, content, classification, imageUrl, deleted = false, ...rest }) {
        if (!id) {
            throw new Error('DocumentItem requires id');
        }
        if (!type) {
            throw new Error('DocumentItem requires type');
        }

        this.id = id;
        this.type = type;
        this.content = content;
        this.classification = classification;
        this.imageUrl = imageUrl;
        this.deleted = deleted;
        // Preserve any additional fields (e.g., bbox, metadata)
        Object.assign(this, rest);
        Object.freeze(this);
    }

    // ============ TYPE GETTERS ============

    get isText() {
        return this.type === 'text';
    }

    get isImage() {
        return this.type === 'image' || this.type === 'picture';
    }

    get isTable() {
        return this.type === 'table';
    }

    get isDeleted() {
        return this.deleted === true;
    }

    get isEmpty() {
        return this.isText && (!this.content || this.content.trim().length <= 1);
    }

    get isActive() {
        return !this.isDeleted;
    }

    // ============ DISPLAY GETTERS ============

    get displayContent() {
        if (this.isDeleted) return '[Deleted]';
        if (this.isImage) return this.classification || '[Image]';
        if (this.isTable) return '[Table]';
        return this.content || '';
    }

    get truncatedContent() {
        const content = this.displayContent;
        return content.length > 100 ? content.substring(0, 100) + '...' : content;
    }

    // ============ SETTERS (return new instance) ============

    withContent(newContent) {
        return new DocumentItem({ ...this, content: newContent });
    }

    withClassification(newClassification) {
        return new DocumentItem({ ...this, classification: newClassification });
    }

    withDeleted(deleted) {
        return new DocumentItem({ ...this, deleted });
    }

    markDeleted() {
        return this.withDeleted(true);
    }

    restore() {
        return this.withDeleted(false);
    }

    // ============ SERIALIZATION ============

    toJSON() {
        const json = { ...this };
        // Remove undefined values for cleaner output
        Object.keys(json).forEach(key => json[key] === undefined && delete json[key]);
        return json;
    }

    static fromJSON(json) {
        return new DocumentItem(json);
    }
}

/**
 * Document Page
 */
export class DocumentPage {
    /**
     * Internal constructor - accepts typed items array.
     * Use static factory methods for creating from plain objects.
     * 
     * @param {number} pageNumber - 1-indexed page number
     * @param {DocumentItem[]} items - Array of DocumentItem instances
     */
    constructor(pageNumber, items = []) {
        if (pageNumber === undefined || pageNumber === null) {
            throw new Error('DocumentPage requires pageNumber');
        }

        this.pageNumber = pageNumber;
        this.items = items;
        Object.freeze(this);
    }

    /**
     * Create a new DocumentPage preserving unchanged arrays (structural sharing)
     * @private
     */
    _with({ pageNumber, items }) {
        return new DocumentPage(
            pageNumber !== undefined ? pageNumber : this.pageNumber,
            items !== undefined ? items : this.items,
        );
    }

    // ============ ITEM GETTERS ============

    get activeItems() {
        return this.items.filter(item => !item.isDeleted);
    }

    get textItems() {
        return this.items.filter(item => item.isText && !item.isDeleted);
    }

    get imageItems() {
        return this.items.filter(item => item.isImage && !item.isDeleted);
    }

    get tableItems() {
        return this.items.filter(item => item.isTable && !item.isDeleted);
    }

    get deletedItems() {
        return this.items.filter(item => item.isDeleted);
    }

    get itemCount() {
        return this.items.length;
    }

    get activeItemCount() {
        return this.activeItems.length;
    }

    // ============ LOOKUP METHODS ============

    getItemById(itemId) {
        return this.items.find(item => item.id === itemId) || null;
    }

    hasItem(itemId) {
        return this.items.some(item => item.id === itemId);
    }

    // ============ SETTERS (return new instance) ============

    withItem(itemId, updater) {
        const newItems = this.items.map(item =>
            item.id === itemId ? updater(item) : item
        );
        return this._with({ items: newItems });
    }

    withItems(items) {
        return this._with({ items });
    }

    updateItem(itemId, newContent) {
        return this.withItem(itemId, item => item.withContent(newContent));
    }

    deleteItem(itemId) {
        return this.withItem(itemId, item => item.markDeleted());
    }

    restoreItem(itemId) {
        return this.withItem(itemId, item => item.restore());
    }

    // ============ SERIALIZATION ============

    toJSON() {
        return {
            pageNumber: this.pageNumber,
            items: this.items.map(item => item.toJSON()),
        };
    }

    /**
     * Create from plain objects (e.g., from localStorage or API)
     */
    static fromJSON(json) {
        const items = (json.items || []).map(item =>
            item instanceof DocumentItem ? item : new DocumentItem(item)
        );
        return new DocumentPage(json.pageNumber, items);
    }
}

/**
 * Document State (full document with all pages)
 */
export class DocumentState {
    /**
     * Internal constructor - accepts typed pages array.
     * Use static factory methods for creating from plain objects.
     * 
     * @param {string} filename - Document filename
     * @param {string} documentId - Document ID
     * @param {DocumentPage[]} pages - Array of DocumentPage instances
     */
    constructor(filename = '', documentId = '', pages = []) {
        this.filename = filename;
        this.documentId = documentId;
        this.pages = pages;
        Object.freeze(this);
    }

    /**
     * Create a new DocumentState preserving unchanged arrays (structural sharing)
     * @private
     */
    _with({ filename, documentId, pages }) {
        return new DocumentState(
            filename !== undefined ? filename : this.filename,
            documentId !== undefined ? documentId : this.documentId,
            pages !== undefined ? pages : this.pages,
        );
    }

    // ============ PAGE NAVIGATION GETTERS ============

    get totalPages() {
        return this.pages.length;
    }

    get maxPage() {
        return this.pages.length;
    }

    get isEmpty() {
        return this.pages.length === 0;
    }

    /**
     * Get page by 1-indexed page number
     * @param {number} pageNumber - 1-indexed page number
     * @returns {DocumentPage|null}
     */
    getPage(pageNumber) {
        if (pageNumber < 1 || pageNumber > this.maxPage) return null;
        return this.pages[pageNumber - 1] || null;
    }

    /**
     * Clamp page number to valid range [1, maxPage]
     * Used by components to ensure valid page navigation
     * @param {number} page - Requested page number
     * @returns {number} - Valid page number
     */
    clampPage(page) {
        if (this.isEmpty) return 1;
        return Math.max(1, Math.min(page, this.maxPage));
    }

    /**
     * Check if page number is valid
     * @param {number} page - Page number to check
     * @returns {boolean}
     */
    isValidPage(page) {
        return page >= 1 && page <= this.maxPage;
    }

    // ============ ITEM GETTERS ============

    get totalItems() {
        return this.pages.reduce((sum, page) => sum + page.itemCount, 0);
    }

    get totalActiveItems() {
        return this.pages.reduce((sum, page) => sum + page.activeItemCount, 0);
    }

    get allItems() {
        return this.pages.flatMap(page => page.items);
    }

    get allActiveItems() {
        return this.pages.flatMap(page => page.activeItems);
    }

    get allImages() {
        return this.pages.flatMap(page => page.imageItems);
    }

    get allTextItems() {
        return this.pages.flatMap(page => page.textItems);
    }

    /**
     * Get an item by ID from any page
     * @param {string} itemId - Item ID to find
     * @returns {DocumentItem|null}
     */
    getItemById(itemId) {
        for (const page of this.pages) {
            const item = page.getItemById(itemId);
            if (item) return item;
        }
        return null;
    }

    /**
     * Get the page containing an item
     * @param {string} itemId - Item ID to find
     * @returns {DocumentPage|null}
     */
    getPageForItem(itemId) {
        for (const page of this.pages) {
            if (page.hasItem(itemId)) return page;
        }
        return null;
    }

    /**
     * Get the page number containing an item
     * @param {string} itemId - Item ID to find
     * @returns {number|null} - 1-indexed page number or null
     */
    getPageNumberForItem(itemId) {
        const page = this.getPageForItem(itemId);
        return page ? page.pageNumber : null;
    }

    // ============ SETTERS (return new instance) ============

    withPage(pageNumber, updater) {
        const newPages = this.pages.map(page =>
            page.pageNumber === pageNumber ? updater(page) : page
        );
        return this._with({ pages: newPages });
    }

    withItem(itemId, updater) {
        const newPages = this.pages.map(page => {
            const item = page.getItemById(itemId);
            if (item) {
                return page.withItem(itemId, updater);
            }
            return page;
        });
        return this._with({ pages: newPages });
    }

    updateItem(itemId, newContent) {
        return this.withItem(itemId, item => item.withContent(newContent));
    }

    deleteItem(itemId) {
        return this.withItem(itemId, item => item.markDeleted());
    }

    restoreItem(itemId) {
        return this.withItem(itemId, item => item.restore());
    }

    updateItemClassification(itemId, classification) {
        return this.withItem(itemId, item => item.withClassification(classification));
    }

    withFilename(filename) {
        return this._with({ filename });
    }

    // ============ SERIALIZATION ============

    toJSON() {
        return {
            filename: this.filename,
            documentId: this.documentId,
            pages: this.pages.map(page => page.toJSON()),
        };
    }

    /**
     * Create from plain objects (e.g., from localStorage or API)
     */
    static fromJSON(json) {
        if (!json) return null;
        const pages = (json.pages || []).map(page =>
            page instanceof DocumentPage ? page : DocumentPage.fromJSON(page)
        );
        return new DocumentState(
            json.filename || '',
            json.documentId || '',
            pages,
        );
    }

    static empty() {
        return new DocumentState('', '', []);
    }
}

/**
 * Document Domain Model
 * Manages document state, pagination, and content type
 */
export class DocumentModel {
    /**
     * @param {Object} data
     * @param {Object|DocumentState|null} [data.documentState] - Current document
     * @param {number} [data.currentPage] - Current page (1-indexed)
     * @param {string} [data.contentType] - Content type (editor/embedding)
     * @param {Object|null} [data.storedEmbeddings] - Stored embeddings for read-only view
     */
    constructor({
        documentState = null,
        currentPage = 1,
        contentType = CONTENT_TYPE.EDITOR,
        storedEmbeddings = null,
    } = {}) {
        this.documentState = documentState instanceof DocumentState
            ? documentState
            : (documentState ? DocumentState.fromJSON(documentState) : null);
        this.currentPage = currentPage;
        this.contentType = contentType;
        this.storedEmbeddings = storedEmbeddings;
        Object.freeze(this);
    }

    // ============ DOCUMENT GETTERS ============

    get hasDocument() {
        return this.documentState !== null;
    }

    get isEditorMode() {
        return this.contentType === CONTENT_TYPE.EDITOR;
    }

    get isEmbeddingMode() {
        return this.contentType === CONTENT_TYPE.EMBEDDING;
    }

    get hasStoredEmbeddings() {
        return this.storedEmbeddings !== null;
    }

    // ============ DELEGATION TO DOCUMENT STATE ============
    // These provide convenient access without needing to null-check

    get totalPages() {
        return this.documentState?.totalPages || 0;
    }

    get maxPage() {
        return this.documentState?.maxPage || 0;
    }

    get currentPageData() {
        return this.documentState?.getPage(this.currentPage) || null;
    }

    get filename() {
        return this.documentState?.filename || '';
    }

    get documentId() {
        return this.documentState?.documentId || '';
    }

    // ============ PAGE NAVIGATION ============

    get canGoNext() {
        return this.currentPage < this.totalPages;
    }

    get canGoPrevious() {
        return this.currentPage > 1;
    }

    clampPage(page) {
        if (!this.hasDocument) return 1;
        return this.documentState.clampPage(page);
    }

    isValidPage(page) {
        if (!this.hasDocument) return page === 1;
        return this.documentState.isValidPage(page);
    }

    // ============ ITEM ACCESS ============

    getItemById(itemId) {
        return this.documentState?.getItemById(itemId) || null;
    }

    getPageForItem(itemId) {
        return this.documentState?.getPageForItem(itemId) || null;
    }

    // ============ SETTERS ============

    loadDocument(documentState, documentId) {
        const docState = documentState instanceof DocumentState
            ? documentState
            : DocumentState.fromJSON({ ...documentState, documentId });

        return new DocumentModel({
            ...this,
            documentState: docState,
            currentPage: 1,
            contentType: CONTENT_TYPE.EDITOR,
            storedEmbeddings: null,
        });
    }

    modifyDocument(documentState) {
        return new DocumentModel({
            ...this,
            documentState: documentState instanceof DocumentState
                ? documentState
                : DocumentState.fromJSON(documentState),
        });
    }

    resetDocument() {
        return new DocumentModel({
            ...this,
            documentState: null,
            currentPage: 1,
        });
    }

    changePage(page) {
        const clampedPage = this.clampPage(page);
        return new DocumentModel({
            ...this,
            currentPage: clampedPage,
        });
    }

    setContentType(contentType) {
        return new DocumentModel({
            ...this,
            contentType,
        });
    }

    setStoredEmbeddings(embeddings) {
        return new DocumentModel({
            ...this,
            storedEmbeddings: embeddings,
            contentType: CONTENT_TYPE.EMBEDDING,
            documentState: null,
            currentPage: 1,
        });
    }

    clearStoredEmbeddings() {
        return new DocumentModel({
            ...this,
            storedEmbeddings: null,
            contentType: CONTENT_TYPE.EDITOR,
        });
    }

    // ============ SERIALIZATION ============

    toJSON() {
        return {
            documentState: this.documentState?.toJSON() || null,
            currentPage: this.currentPage,
            contentType: this.contentType,
            storedEmbeddings: this.storedEmbeddings,
        };
    }

    static fromJSON(json) {
        return new DocumentModel(json);
    }

    static empty() {
        return new DocumentModel({});
    }
}

export default DocumentModel;
