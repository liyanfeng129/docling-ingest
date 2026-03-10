/**
 * CacheManagement Component
 * 
 * Provides UI for managing local cache - view and clear cached data.
 * Options to clear:
 * - Content/editor data (pages, items)
 * - Embedding data (ingested embeddings)
 * - Both
 * - Specific files
 */

import { useState, useMemo, useCallback } from 'react';
import { toast } from 'react-toastify';
import {
    loadFromCache,
    saveToCache,
    clearCache,
    clearKeysWithPrefix,
} from '../../../hooks/useLocalCache';
import { INGESTION_CONFIG } from '../../../config/ingestionConfig';
import { removeIngestedFile, getIngestedFiles } from '../../../utils/fileCacheManager';

/**
 * Format bytes to human readable
 */
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Cache item row
 */
function CacheItem({ item, isSelected, onSelect }) {
    const getTypeIcon = (type) => {
        switch (type) {
            case 'editor': return '📝';
            case 'file': return '📄';
            case 'embedding': return '🧠';
            default: return '📦';
        }
    };

    const getTypeLabel = (type) => {
        switch (type) {
            case 'editor': return 'Editor';
            case 'file': return 'File';
            case 'embedding': return 'Ingested';
            default: return 'Data';
        }
    };

    return (
        <div
            className={`
                flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors
                ${isSelected ? 'bg-brand-blue-light-5 border border-brand-blue' : 'hover:bg-brand-grey-9 border border-transparent'}
            `}
            onClick={() => onSelect(item.key)}
        >
            <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onSelect(item.key)}
                onClick={(e) => e.stopPropagation()}
                className="w-4 h-4 rounded border-brand-grey-4 text-brand-blue 
                    focus:ring-brand-blue focus:ring-1 cursor-pointer"
            />
            <div className="flex-1 min-w-0">
                <p className="text-sm text-brand-black truncate" title={item.filename || item.key}>
                    {item.filename || item.key}
                </p>
                <p className="text-xs text-brand-grey-4">
                    {getTypeIcon(item.type)} {getTypeLabel(item.type)} • {formatBytes(item.size)}
                </p>
            </div>
        </div>
    );
}

export default function CacheManagement({ onClose, onCacheCleared }) {
    const [selectedKeys, setSelectedKeys] = useState(new Set());
    const [isClearing, setIsClearing] = useState(false);

    // Get all cached items
    const cachedItems = useMemo(() => {
        const items = [];

        // Check for edit state
        const editState = loadFromCache(INGESTION_CONFIG.storage.editStateKey);
        if (editState) {
            const key = INGESTION_CONFIG.storage.editStateKey;
            const size = JSON.stringify(editState).length * 2;
            items.push({
                key,
                type: 'editor',
                filename: editState.documentState?.filename || 'Current Session',
                size,
                data: editState,
            });
        }

        // Get uploaded files and merge with their content data
        // From user's perspective, these are just "files" - not separate uploaded/content items
        const uploadedFiles = loadFromCache(INGESTION_CONFIG.storage.uploadedFilesKey) || [];
        uploadedFiles.forEach(file => {
            const contentKey = `${INGESTION_CONFIG.storage.contentFilesPrefix}${file.documentId}`;
            const contentData = loadFromCache(contentKey);

            // Calculate combined size (file metadata + content)
            let totalSize = JSON.stringify(file).length * 2;
            if (contentData) {
                totalSize += JSON.stringify(contentData).length * 2;
            }

            items.push({
                key: file.documentId, // Use documentId as key for file items
                type: 'file',
                filename: file.filename || file.documentId,
                size: totalSize,
                documentId: file.documentId,
                hasContent: !!contentData,
            });
        });

        // Check for embedding caches (ingested files)
        // Use the ingested files list as source of truth
        const ingestedFiles = getIngestedFiles();
        ingestedFiles.forEach(file => {
            const embeddingKey = `${INGESTION_CONFIG.storage.embeddingCachePrefix}${file.ingestedId}`;
            const embeddingData = loadFromCache(embeddingKey);

            // Calculate size (entry metadata + embedding data if exists)
            let size = JSON.stringify(file).length * 2;
            if (embeddingData) {
                size += JSON.stringify(embeddingData).length * 2;
            }

            // Count associated ingestionIds for display
            const ingestionCount = file.ingestionIds?.length || (file.ingestionId ? 1 : 0);

            items.push({
                key: file.ingestedId, // Use ingestedId as key for UI
                type: 'embedding',
                filename: file.originalFilename || file.filename || file.documentId,
                size,
                data: embeddingData,
                documentId: file.documentId,
                ingestedId: file.ingestedId,
                ingestionIds: file.ingestionIds || [],
                strategy: file.strategy,
                targetDb: file.targetDb,
                ingestionCount,
            });
        });

        return items;
    }, []);

    // Group items by type (simplified: editor, file, embedding)
    const editorItems = cachedItems.filter(i => i.type === 'editor');
    const fileItems = cachedItems.filter(i => i.type === 'file');
    const embeddingItems = cachedItems.filter(i => i.type === 'embedding');

    // Calculate totals
    const totalSize = cachedItems.reduce((sum, item) => sum + item.size, 0);
    const selectedSize = cachedItems
        .filter(item => selectedKeys.has(item.key))
        .reduce((sum, item) => sum + item.size, 0);

    const handleSelectItem = useCallback((key) => {
        setSelectedKeys(prev => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    }, []);

    const handleSelectAllFiles = useCallback(() => {
        const fileKeys = fileItems.map(i => i.key);
        const allSelected = fileKeys.every(k => selectedKeys.has(k));
        setSelectedKeys(prev => {
            const next = new Set(prev);
            if (allSelected) {
                fileKeys.forEach(k => next.delete(k));
            } else {
                fileKeys.forEach(k => next.add(k));
            }
            return next;
        });
    }, [fileItems, selectedKeys]);

    const handleSelectAllEmbeddings = useCallback(() => {
        const embeddingKeysArr = embeddingItems.map(i => i.key);
        const allSelected = embeddingKeysArr.every(k => selectedKeys.has(k));
        setSelectedKeys(prev => {
            const next = new Set(prev);
            if (allSelected) {
                embeddingKeysArr.forEach(k => next.delete(k));
            } else {
                embeddingKeysArr.forEach(k => next.add(k));
            }
            return next;
        });
    }, [embeddingItems, selectedKeys]);

    const handleClearSelected = useCallback(async () => {
        if (selectedKeys.size === 0) return;

        setIsClearing(true);
        try {
            // Determine what types are being cleared
            const clearedTypes = new Set();
            const clearedItems = cachedItems.filter(item => selectedKeys.has(item.key));
            clearedItems.forEach(item => clearedTypes.add(item.type));

            // Clear selected items - handle file and embedding items specially
            clearedItems.forEach(item => {
                if (item.type === 'file') {
                    // For file items, remove from uploaded files list AND clear content cache
                    const uploadedFiles = loadFromCache(INGESTION_CONFIG.storage.uploadedFilesKey) || [];
                    const filteredFiles = uploadedFiles.filter(f => f.documentId !== item.documentId);
                    if (filteredFiles.length > 0) {
                        saveToCache(INGESTION_CONFIG.storage.uploadedFilesKey, filteredFiles);
                    } else {
                        clearCache(INGESTION_CONFIG.storage.uploadedFilesKey);
                    }
                    // Clear content cache
                    clearCache(`${INGESTION_CONFIG.storage.contentFilesPrefix}${item.documentId}`);
                } else if (item.type === 'embedding') {
                    // For embedding items, use removeIngestedFile which handles:
                    // - Removing from ingested files list
                    // - Clearing all associated ingestionIds (for duplicate detection)
                    // - Clearing embedding cache
                    removeIngestedFile(item.ingestedId);
                } else {
                    // For other items (editor), just clear the key
                    clearCache(item.key);
                }
            });

            // Map 'file' type to 'uploaded' and 'content' for parent notification
            const notifyTypes = Array.from(clearedTypes).flatMap(type =>
                type === 'file' ? ['uploaded', 'content'] : [type]
            );

            toast.success(`Cleared ${selectedKeys.size} cached item(s)`);
            setSelectedKeys(new Set());

            // Notify parent about what was cleared
            onCacheCleared?.({
                all: false,
                types: notifyTypes,
            });

            // Close after a short delay to show success
            setTimeout(() => onClose?.(), 500);
        } catch (error) {
            console.error('Failed to clear cache:', error);
            toast.error('Failed to clear cache');
        } finally {
            setIsClearing(false);
        }
    }, [selectedKeys, onClose, onCacheCleared, cachedItems]);

    const handleClearAll = useCallback(async () => {
        setIsClearing(true);
        try {
            // Clear edit state
            clearCache(INGESTION_CONFIG.storage.editStateKey);

            // Clear uploaded files list
            clearCache(INGESTION_CONFIG.storage.uploadedFilesKey);

            // Clear all content caches
            clearKeysWithPrefix(INGESTION_CONFIG.storage.contentFilesPrefix);

            // Clear all embeddings
            clearKeysWithPrefix(INGESTION_CONFIG.storage.embeddingCachePrefix);

            // Clear ingested files list
            clearCache(INGESTION_CONFIG.storage.ingestedFilesKey);

            toast.success('All cache cleared');
            setSelectedKeys(new Set());

            // Notify parent that all cache was cleared
            onCacheCleared?.({
                all: true,
                types: ['editor', 'uploaded', 'content', 'embedding'],
            });

            setTimeout(() => onClose?.(), 500);
        } catch (error) {
            console.error('Failed to clear cache:', error);
            toast.error('Failed to clear cache');
        } finally {
            setIsClearing(false);
        }
    }, [onClose, onCacheCleared]);

    if (cachedItems.length === 0) {
        return (
            <div className="p-4 text-center">
                <div className="text-4xl mb-2">📭</div>
                <p className="text-sm text-brand-grey-4">No cached data</p>
                <button
                    onClick={onClose}
                    className="mt-3 text-sm text-brand-blue hover:underline"
                >
                    Close
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full min-h-0">
            {/* Header */}
            <div className="flex-shrink-0 px-4 py-3 border-b border-brand-grey-7 bg-brand-grey-9 relative">
                <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-brand-black">Cache Management</h4>
                    <button
                        onClick={onClose}
                        className="text-brand-grey-4 hover:text-red-500 bg-transparent hover:bg-red-50 rounded-full p-1 transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <p className="text-xs text-brand-grey-4">
                    Total: {formatBytes(totalSize)} • {cachedItems.length} item(s)
                </p>
            </div>

            {/* Content - scrollable */}
            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
                {/* Editor Cache Section */}
                {editorItems.length > 0 && (
                    <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                            <h5 className="text-xs font-semibold text-brand-grey-3 uppercase tracking-wide">
                                📝 Editor Session ({editorItems.length})
                            </h5>
                        </div>
                        <div className="space-y-1">
                            {editorItems.map(item => (
                                <CacheItem
                                    key={item.key}
                                    item={item}
                                    isSelected={selectedKeys.has(item.key)}
                                    onSelect={handleSelectItem}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* Uploaded Files Section (merged uploaded + content) */}
                {fileItems.length > 0 && (
                    <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                            <h5 className="text-xs font-semibold text-brand-grey-3 uppercase tracking-wide">
                                📄 Uploaded Files ({fileItems.length})
                            </h5>
                            <button
                                onClick={handleSelectAllFiles}
                                className="px-3 py-1 text-xs font-medium rounded-full bg-brand-blue-light-5 text-brand-blue hover:bg-brand-blue-light-3 transition-colors"
                            >
                                {fileItems.every(i => selectedKeys.has(i.key)) ? 'Deselect All' : 'Select All'}
                            </button>
                        </div>
                        <div className="space-y-1">
                            {fileItems.map(item => (
                                <CacheItem
                                    key={item.key}
                                    item={item}
                                    isSelected={selectedKeys.has(item.key)}
                                    onSelect={handleSelectItem}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* Ingested/Embeddings Cache Section */}
                {embeddingItems.length > 0 && (
                    <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                            <h5 className="text-xs font-semibold text-brand-grey-3 uppercase tracking-wide">
                                🧠 Ingested Files ({embeddingItems.length})
                            </h5>
                            <button
                                onClick={handleSelectAllEmbeddings}
                                className="px-3 py-1 text-xs font-medium rounded-full bg-brand-blue-light-5 text-brand-blue hover:bg-brand-blue-light-3 transition-colors"
                            >
                                {embeddingItems.every(i => selectedKeys.has(i.key)) ? 'Deselect All' : 'Select All'}
                            </button>
                        </div>
                        <div className="space-y-1">
                            {embeddingItems.map(item => (
                                <CacheItem
                                    key={item.key}
                                    item={item}
                                    isSelected={selectedKeys.has(item.key)}
                                    onSelect={handleSelectItem}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Footer Actions - fixed at bottom */}
            <div className="flex-shrink-0 px-4 py-3 border-t border-brand-grey-7 bg-brand-grey-9 space-y-2">
                {selectedKeys.size > 0 && (
                    <p className="text-xs text-brand-grey-4 text-center">
                        {selectedKeys.size} selected • {formatBytes(selectedSize)}
                    </p>
                )}

                <div className="flex gap-2">
                    <button
                        onClick={handleClearSelected}
                        disabled={selectedKeys.size === 0 || isClearing}
                        className="flex-1 px-3 py-2 text-sm font-medium text-white bg-brand-blue 
                            rounded-lg hover:bg-brand-dark-blue transition-colors
                            disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isClearing ? 'Clearing...' : `Clear Selected (${selectedKeys.size})`}
                    </button>
                </div>

                <button
                    onClick={handleClearAll}
                    disabled={isClearing}
                    className="w-full px-3 py-2 text-sm font-medium text-brand-red bg-white 
                        border border-brand-red/30 rounded-lg hover:bg-brand-red/10 transition-colors
                        disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Clear All Cache
                </button>
            </div>
        </div>
    );
}
