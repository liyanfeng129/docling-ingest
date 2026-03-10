/**
 * File Cache Manager
 * 
 * Utility functions for managing two types of cached files:
 * 1. Uploaded/Content files (for ContentViewer) - files uploaded but not yet ingested
 * 2. Ingested files (for EmbeddingPreview read mode) - files that have been ingested
 */

import { INGESTION_CONFIG } from '../config/ingestionConfig';
import { loadFromCache, saveToCache, clearCache, getKeysWithPrefix } from '../hooks/useLocalCache';

/**
 * File metadata structure:
 * {
 *   id: string,          // Unique queue ID (upload_timestamp_random)
 *   documentId: string,  // Backend document ID
 *   filename: string,    // Original filename
 *   status: string,      // DOC_STATUS value
 *   uploadedAt: string,  // ISO timestamp
 *   ingestedAt?: string, // ISO timestamp (only for ingested files)
 * }
 */

// ==================== CONTENT FINGERPRINT ====================

/**
 * Generate a lightweight content fingerprint for deduplication.
 * 
 * This creates a hash from the document content that changes when:
 * - Text content is edited
 * - Items are deleted/restored
 * - Pages are modified
 * 
 * The fingerprint is used to detect if the SAME content has already been
 * ingested with the same strategy to the same DB.
 * 
 * @param {Object} documentState - The document state with pages/items
 * @returns {string} - A fingerprint string (not cryptographically secure, just for comparison)
 */
export const generateContentFingerprint = (documentState) => {
    if (!documentState || !documentState.pages) {
        return 'empty';
    }

    // Build a string representation of all active content
    const contentParts = [];

    for (const page of documentState.pages) {
        const items = page.items || [];
        for (const item of items) {
            // Skip deleted items - they don't affect the final embedding
            if (item.deleted) continue;

            // Include item type and content
            if (item.type === 'text' && item.content) {
                contentParts.push(`t:${item.content}`);
            } else if (item.type === 'image' || item.type === 'picture') {
                // For images, use classification or imageUrl as identifier
                contentParts.push(`i:${item.classification || item.imageUrl || item.id}`);
            } else if (item.type === 'table') {
                contentParts.push(`tb:${item.content || item.id}`);
            }
        }
    }

    // Simple hash function (djb2)
    const str = contentParts.join('|');
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i);
        hash = hash & hash; // Convert to 32-bit integer
    }

    // Convert to base36 for shorter string
    return Math.abs(hash).toString(36);
};

/**
 * Generate a unique ingestion ID based on content, strategy, and target DB.
 * 
 * This ID uniquely identifies an ingestion attempt:
 * - Same content + same strategy + same DB = same ID (duplicate)
 * - Any difference = different ID (allow ingestion)
 * 
 * @param {Object} documentState - The document state
 * @param {string} strategy - Ingestion strategy
 * @param {string} targetDb - Target database/collection
 * @returns {string} - Unique ingestion ID
 */
export const generateIngestionId = (documentState, strategy, targetDb) => {
    const contentFingerprint = generateContentFingerprint(documentState);
    return `${contentFingerprint}_${strategy}_${targetDb}`;
};

/**
 * Generate an ingestedId based on content and strategy.
 * 
 * This ID groups ingestions by content + strategy (for sidebar display):
 * - Same content + same strategy = same ingestedId (one sidebar entry)
 * - Same content ingested to different DBs = same sidebar entry, multiple ingestionIds
 * 
 * @param {Object} documentState - The document state
 * @param {string} strategy - Ingestion strategy
 * @returns {string} - Ingested ID
 */
export const generateIngestedId = (documentState, strategy) => {
    const contentFingerprint = generateContentFingerprint(documentState);
    return `${contentFingerprint}_${strategy}`;
};

/**
 * Check if content has already been ingested with same strategy to same DB.
 * Checks against all ingestionIds stored in ingestionIds array.
 * 
 * @param {Object} documentState - The document state
 * @param {string} strategy - Ingestion strategy
 * @param {string} targetDb - Target database/collection
 * @returns {{ isDuplicate: boolean, existingEntry: Object|null, ingestionId: string }}
 */
export const checkIngestionDuplicate = (documentState, strategy, targetDb) => {
    const ingestionId = generateIngestionId(documentState, strategy, targetDb);
    const ingestedFiles = getIngestedFiles();

    // Check both ingestionIds array and legacy single ingestionId field
    const existingEntry = ingestedFiles.find(f => {
        // Check in ingestionIds array first
        if (f.ingestionIds && Array.isArray(f.ingestionIds)) {
            if (f.ingestionIds.includes(ingestionId)) {
                return true;
            }
        }
        // Fallback: check legacy single ingestionId field
        return f.ingestionId === ingestionId;
    });

    return {
        isDuplicate: !!existingEntry,
        existingEntry,
        ingestionId,
    };
};

// ==================== UPLOADED FILES (Content Viewer) ====================

/**
 * Get list of uploaded file metadata
 * @returns {Array} - Array of file metadata objects
 */
export const getUploadedFiles = () => {
    return loadFromCache(INGESTION_CONFIG.storage.uploadedFilesKey) || [];
};

/**
 * Save uploaded files list
 * @param {Array} files - Array of file metadata
 */
export const saveUploadedFiles = (files) => {
    saveToCache(INGESTION_CONFIG.storage.uploadedFilesKey, files);
};

/**
 * Add a new uploaded file to cache
 * @param {Object} fileMetadata - File metadata object
 */
export const addUploadedFile = (fileMetadata) => {
    const files = getUploadedFiles();
    // Check if already exists (by documentId)
    const exists = files.some(f => f.documentId === fileMetadata.documentId);
    if (!exists) {
        files.push({
            ...fileMetadata,
            uploadedAt: new Date().toISOString(),
        });
        saveUploadedFiles(files);
    }
};

/**
 * Update an uploaded file's metadata
 * @param {string} documentId - Document ID to update
 * @param {Object} updates - Fields to update
 */
export const updateUploadedFile = (documentId, updates) => {
    const files = getUploadedFiles();
    const index = files.findIndex(f => f.documentId === documentId);
    if (index !== -1) {
        files[index] = { ...files[index], ...updates };
        saveUploadedFiles(files);
    }
};

/**
 * Remove an uploaded file from cache
 * Also removes any ingested versions of this file and their embedding caches
 * 
 * @param {string} documentId - Document ID to remove
 * @returns {string[]} - Array of removed ingested IDs (for callers that need to update state)
 */
export const removeUploadedFile = (documentId) => {
    const files = getUploadedFiles();
    const filtered = files.filter(f => f.documentId !== documentId);
    saveUploadedFiles(filtered);

    // Also clear the content cache for this file
    clearCache(`${INGESTION_CONFIG.storage.contentFilesPrefix}${documentId}`);

    // Also clear the command history for this file
    clearCache(`${INGESTION_CONFIG.storage.historyPrefix}${documentId}`);

    // Also remove any ingested versions of this file
    const ingestedFiles = getIngestedFiles();
    const relatedIngested = ingestedFiles.filter(f => f.documentId === documentId);
    const removedIngestedIds = relatedIngested.map(f => f.ingestedId);

    // Remove from ingested files list
    const filteredIngested = ingestedFiles.filter(f => f.documentId !== documentId);
    saveIngestedFiles(filteredIngested);

    // Clear embedding caches for removed ingested files
    removedIngestedIds.forEach(ingestedId => {
        clearCache(`${INGESTION_CONFIG.storage.embeddingCachePrefix}${ingestedId}`);
    });

    return removedIngestedIds;
};

/**
 * Save content data for a specific file
 * @param {string} documentId - Document ID
 * @param {Object} content - Extracted content data
 */
export const saveFileContent = (documentId, content) => {
    const key = `${INGESTION_CONFIG.storage.contentFilesPrefix}${documentId}`;
    saveToCache(key, content);
};

/**
 * Get content data for a specific file
 * @param {string} documentId - Document ID
 * @returns {Object|null} - Content data or null
 */
export const getFileContent = (documentId) => {
    const key = `${INGESTION_CONFIG.storage.contentFilesPrefix}${documentId}`;
    return loadFromCache(key);
};

// ==================== INGESTED FILES (Embedding Preview) ====================

/**
 * Get list of ingested file metadata
 * Normalizes legacy entries that may be missing ingestedId
 * @returns {Array} - Array of ingested file metadata
 */
export const getIngestedFiles = () => {
    const files = loadFromCache(INGESTION_CONFIG.storage.ingestedFilesKey) || [];

    // Normalize legacy entries that don't have ingestedId
    return files.map(file => {
        if (!file.ingestedId) {
            // Legacy format: generate ingestedId from documentId + strategy
            const strategy = file.strategy || 'default';
            const ingestedId = `${file.documentId}_${strategy}`;
            return {
                ...file,
                id: ingestedId,
                ingestedId,
                strategy,
            };
        }
        return file;
    });
};

/**
 * Save ingested files list
 * @param {Array} files - Array of ingested file metadata
 */
export const saveIngestedFiles = (files) => {
    saveToCache(INGESTION_CONFIG.storage.ingestedFilesKey, files);
};

/**
 * Create or update an ingested file entry
 * - Does NOT remove the uploaded file (user may want to re-ingest with different strategy)
 * - Creates ingested entry keyed by content + strategy (ingestedId)
 * - If same content + strategy exists, updates it and adds new ingestionId
 * - Different content = different sidebar entry
 * - Stores ingestionIds array for duplicate detection
 * 
 * @param {string} documentId - Original document ID
 * @param {string} strategy - Ingestion strategy used
 * @param {Object} embeddingData - Embedding preview data to cache
 * @param {Object} fileInfo - Optional file info (filename, etc.) - if not provided, will look up from uploaded files
 * @param {string} [targetDb] - Target database (optional)
 * @param {string} [ingestionId] - Content-based ingestion ID for duplicate detection (contentHash_strategy_targetDb)
 * @param {string} [ingestedId] - Content-based ID for sidebar grouping (contentHash_strategy)
 */
export const createIngestedFile = (documentId, strategy, embeddingData, fileInfo = null, targetDb = null, ingestionId = null, ingestedId = null) => {
    // Get file info from uploaded files if not provided
    let file = fileInfo;
    if (!file) {
        const uploadedFiles = getUploadedFiles();
        file = uploadedFiles.find(f => f.documentId === documentId);
    }

    if (!file) {
        console.warn('[fileCacheManager] No file info found for', documentId);
        return null;
    }

    // Use provided ingestedId or fallback to documentId + strategy (legacy behavior)
    const effectiveIngestedId = ingestedId || `${documentId}_${strategy}`;

    // Get existing ingested files
    const ingestedFiles = getIngestedFiles();
    const existingIndex = ingestedFiles.findIndex(f => f.ingestedId === effectiveIngestedId);

    // Calculate embedding count from the embedding data
    const embeddingCount = embeddingData?.chunks?.length ||
        embeddingData?.embeddings?.length ||
        embeddingData?.count || 0;

    // Track all ingestionIds associated with this ingestedId (for proper cleanup on deletion)
    let ingestionIds = [];
    if (existingIndex >= 0) {
        // Preserve existing ingestionIds
        ingestionIds = ingestedFiles[existingIndex].ingestionIds || [];
        // Add legacy single ingestionId if exists and not already in array
        const legacyIngestionId = ingestedFiles[existingIndex].ingestionId;
        if (legacyIngestionId && !ingestionIds.includes(legacyIngestionId)) {
            ingestionIds.push(legacyIngestionId);
        }
    }
    // Add new ingestionId if provided and not already tracked
    if (ingestionId && !ingestionIds.includes(ingestionId)) {
        ingestionIds.push(ingestionId);
    }

    const ingestedEntry = {
        id: effectiveIngestedId,
        ingestedId: effectiveIngestedId,
        ingestionId,  // Latest ingestionId (for backward compatibility)
        ingestionIds, // All ingestionIds associated with this ingestedId
        documentId,  // Keep reference to original document
        strategy,
        targetDb: targetDb || 'default',
        filename: `${file.filename} (${strategy})`,
        originalFilename: file.filename,
        timestamp: Date.now(),
        ingestedAt: new Date().toISOString(),
        status: 'ingested',
        embeddingCount,
    };

    if (existingIndex >= 0) {
        // Update existing entry
        ingestedFiles[existingIndex] = {
            ...ingestedFiles[existingIndex],
            ...ingestedEntry,
            ingestedAt: new Date().toISOString(), // Update timestamp
        };
    } else {
        // Add new entry
        ingestedFiles.push(ingestedEntry);
    }

    saveIngestedFiles(ingestedFiles);

    // Save embedding data with the ingested ID as key
    const embeddingKey = `${INGESTION_CONFIG.storage.embeddingCachePrefix}${effectiveIngestedId}`;
    saveToCache(embeddingKey, {
        ...embeddingData,
        strategy,
        documentId,
        ingestedId: effectiveIngestedId,
    });

    return ingestedEntry;
};

/**
 * Check if an ingested file with same documentId + strategy already exists
 * @param {string} documentId - Document ID
 * @param {string} strategy - Ingestion strategy
 * @returns {Object|null} - Existing ingested file or null
 */
export const getExistingIngestedFile = (documentId, strategy) => {
    const ingestedId = `${documentId}_${strategy}`;
    const ingestedFiles = getIngestedFiles();
    return ingestedFiles.find(f => f.ingestedId === ingestedId) || null;
};

/**
 * @deprecated Use createIngestedFile instead
 * Move a file from uploaded to ingested (legacy function)
 * @param {string} documentId - Document ID
 * @param {Object} embeddingData - Embedding preview data to cache
 */
export const markFileAsIngested = (documentId, embeddingData) => {
    // Get uploaded file info
    const uploadedFiles = getUploadedFiles();
    const file = uploadedFiles.find(f => f.documentId === documentId);

    if (file) {
        // Add to ingested files
        const ingestedFiles = getIngestedFiles();
        const exists = ingestedFiles.some(f => f.documentId === documentId);

        if (!exists) {
            ingestedFiles.push({
                ...file,
                ingestedAt: new Date().toISOString(),
                status: 'ingested',
            });
            saveIngestedFiles(ingestedFiles);
        }

        // NOTE: No longer removing from uploaded files or clearing caches
        // User may want to re-ingest with different strategy

        // Save embedding data
        const embeddingKey = `${INGESTION_CONFIG.storage.embeddingCachePrefix}${documentId}`;
        saveToCache(embeddingKey, embeddingData);
    }
};

/**
 * Remove an ingested file from cache
 * Only removes the ingested file entry and its embedding cache.
 * Does NOT remove the uploaded file (user may want to re-ingest with different strategy).
 * Also clears all associated ingestionIds from duplicate detection.
 * 
 * @param {string} ingestedId - Ingested file ID (documentId_strategy format) or legacy documentId
 */
export const removeIngestedFile = (ingestedId) => {
    const files = getIngestedFiles();

    // Find the entry to get all associated ingestionIds
    const entryToRemove = files.find(f => f.ingestedId === ingestedId || f.documentId === ingestedId);

    // Collect all ingestionIds that need to be cleared from duplicate detection
    const ingestionIdsToClear = [];
    if (entryToRemove) {
        // Add from ingestionIds array
        if (entryToRemove.ingestionIds && Array.isArray(entryToRemove.ingestionIds)) {
            ingestionIdsToClear.push(...entryToRemove.ingestionIds);
        }
        // Also add single ingestionId if not already included
        if (entryToRemove.ingestionId && !ingestionIdsToClear.includes(entryToRemove.ingestionId)) {
            ingestionIdsToClear.push(entryToRemove.ingestionId);
        }
    }

    console.log(`[removeIngestedFile] Removing ingestedId: ${ingestedId}`);
    console.log(`[removeIngestedFile] Associated ingestionIds to clear:`, ingestionIdsToClear);

    // Remove from ingested files list
    const filtered = files.filter(f =>
        f.ingestedId !== ingestedId && f.documentId !== ingestedId
    );
    saveIngestedFiles(filtered);

    // Clear the embedding cache for the ingestedId
    clearCache(`${INGESTION_CONFIG.storage.embeddingCachePrefix}${ingestedId}`);

    // Note: ingestionIds are cleared from the ingested files list above,
    // so checkIngestionDuplicate() will no longer find them
};

/**
 * Get embedding data for an ingested file
 * @param {string} documentId - Document ID
 * @returns {Object|null} - Embedding data or null
 */
export const getIngestedFileEmbeddings = (documentId) => {
    const key = `${INGESTION_CONFIG.storage.embeddingCachePrefix}${documentId}`;
    return loadFromCache(key);
};

// ==================== UTILITY FUNCTIONS ====================

/**
 * Check if a file is ingested
 * @param {string} documentId - Document ID
 * @returns {boolean}
 */
export const isFileIngested = (documentId) => {
    const ingestedFiles = getIngestedFiles();
    return ingestedFiles.some(f => f.documentId === documentId);
};

/**
 * Get all cached files (both uploaded and ingested)
 * @returns {{ uploaded: Array, ingested: Array }}
 */
export const getAllCachedFiles = () => {
    return {
        uploaded: getUploadedFiles(),
        ingested: getIngestedFiles(),
    };
};

/**
 * Clear all file caches
 */
export const clearAllFileCaches = () => {
    // Clear file lists
    clearCache(INGESTION_CONFIG.storage.uploadedFilesKey);
    clearCache(INGESTION_CONFIG.storage.ingestedFilesKey);

    // Clear all content caches
    const contentKeys = getKeysWithPrefix(INGESTION_CONFIG.storage.contentFilesPrefix);
    contentKeys.forEach(key => clearCache(key));

    // Clear all embedding caches
    const embeddingKeys = getKeysWithPrefix(INGESTION_CONFIG.storage.embeddingCachePrefix);
    embeddingKeys.forEach(key => clearCache(key));

    // Clear all history caches
    const historyKeys = getKeysWithPrefix(INGESTION_CONFIG.storage.historyPrefix);
    historyKeys.forEach(key => clearCache(key));
};

// ==================== COMMAND HISTORY ====================

/**
 * Save command history for a file
 * @param {string} documentId - Document ID
 * @param {Object} history - Command history { past, present, future }
 */
export const saveFileHistory = (documentId, history) => {
    const key = `${INGESTION_CONFIG.storage.historyPrefix}${documentId}`;
    // Only save past and future arrays (present is saved in content cache)
    saveToCache(key, {
        past: history.past,
        future: history.future,
    });
};

/**
 * Get command history for a file
 * @param {string} documentId - Document ID
 * @returns {Object|null} - History { past, future } or null
 */
export const getFileHistory = (documentId) => {
    const key = `${INGESTION_CONFIG.storage.historyPrefix}${documentId}`;
    return loadFromCache(key);
};

/**
 * Clear command history for a file
 * @param {string} documentId - Document ID
 */
export const clearFileHistory = (documentId) => {
    const key = `${INGESTION_CONFIG.storage.historyPrefix}${documentId}`;
    clearCache(key);
};

// ==================== STORAGE MANAGEMENT ====================

/**
 * Clear all ingestion-related content from localStorage
 * Used when storage quota is exceeded
 * 
 * Clears:
 * - All file content (ingestion_content_*)
 * - All file history (ingestion_history_*)
 * - All embedding data (ingestion_embeddings_*)
 * 
 * Does NOT clear:
 * - Uploaded files list (metadata only, small)
 * - Ingested files list (metadata only, small)
 */
export const clearAllIngestionContent = () => {
    console.log('[FileCacheManager] Clearing all ingestion content...');

    const prefixesToClear = [
        INGESTION_CONFIG.storage.contentFilesPrefix,  // ingestion_content_
        INGESTION_CONFIG.storage.historyPrefix,       // ingestion_history_
        'ingestion_embeddings_',                      // embeddings data
    ];

    let clearedCount = 0;

    try {
        const keysToRemove = [];

        // Collect keys to remove
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && prefixesToClear.some(prefix => key.startsWith(prefix))) {
                keysToRemove.push(key);
            }
        }

        // Remove collected keys
        for (const key of keysToRemove) {
            localStorage.removeItem(key);
            clearedCount++;
        }

        console.log(`[FileCacheManager] Cleared ${clearedCount} cached items`);
    } catch (error) {
        console.error('[FileCacheManager] Error clearing cache:', error);
    }

    return clearedCount;
};

/**
 * Get localStorage usage statistics
 * @returns {Object} - { used, total, percentage, itemCount }
 */
export const getStorageStats = () => {
    let totalSize = 0;
    let ingestionSize = 0;
    let itemCount = 0;

    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key) {
                const value = localStorage.getItem(key);
                const size = (key.length + (value?.length || 0)) * 2; // UTF-16
                totalSize += size;

                if (key.startsWith('ingestion_')) {
                    ingestionSize += size;
                    itemCount++;
                }
            }
        }
    } catch (error) {
        console.error('Error calculating storage stats:', error);
    }

    // Typical localStorage limit is 5MB
    const limit = 5 * 1024 * 1024;

    return {
        used: totalSize,
        usedMB: (totalSize / (1024 * 1024)).toFixed(2),
        ingestionUsed: ingestionSize,
        ingestionUsedMB: (ingestionSize / (1024 * 1024)).toFixed(2),
        limit,
        limitMB: (limit / (1024 * 1024)).toFixed(2),
        percentage: ((totalSize / limit) * 100).toFixed(1),
        itemCount,
    };
};
