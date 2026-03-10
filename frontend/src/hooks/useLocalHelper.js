/**
 * useLocalHelper Hook
 * 
 * Handles local (frontend-only) helper functions that don't require backend AI processing.
 * Local helpers: remove_logos, remove_empty, delete_regex
 * 
 * Note: ai_image_descriptions is a backend helper that calls the API.
 * 
 * @see doc/ingestion/COMPONENT_RESPONSIBILITIES.md
 */

import { useCallback, useMemo } from 'react';

/**
 * LOCAL HELPERS - IDs that are handled entirely in frontend
 * These helpers modify document state without backend calls
 */
export const LOCAL_HELPERS = ['remove_logos', 'remove_empty', 'delete_regex'];

/**
 * Check if a helper is local (handled in frontend)
 * @param {string} helperId - The helper ID
 * @returns {boolean}
 */
export const isLocalHelper = (helperId) => {
    return LOCAL_HELPERS.includes(helperId);
};

/**
 * Find all items matching logo classification
 * @param {Object} documentState - The document state with pages
 * @returns {Array<string>} - Array of item IDs to delete
 */
export const findLogoItems = (documentState) => {
    const logoItemIds = [];

    if (!documentState?.pages) return logoItemIds;

    for (const page of documentState.pages) {
        for (const item of page.items || []) {
            if (
                (item.type === 'image' || item.type === 'picture') &&
                item.classification === 'logo' &&
                !item.deleted
            ) {
                logoItemIds.push(item.id);
            }
        }
    }

    return logoItemIds;
};

/**
 * Find all empty text items (whitespace only or single character)
 * @param {Object} documentState - The document state with pages
 * @returns {Array<string>} - Array of item IDs to delete
 */
export const findEmptyTextItems = (documentState) => {
    const emptyItemIds = [];

    if (!documentState?.pages) return emptyItemIds;

    for (const page of documentState.pages) {
        for (const item of page.items || []) {
            if (item.type === 'text' && !item.deleted) {
                const trimmed = item.content?.trim() || '';
                if (!trimmed || trimmed.length <= 1) {
                    emptyItemIds.push(item.id);
                }
            }
        }
    }

    return emptyItemIds;
};

/**
 * Find all text items matching a regex pattern
 * @param {Object} documentState - The document state with pages
 * @param {string} pattern - The regex pattern to match
 * @param {string} flags - Regex flags (default: 'gi')
 * @returns {Array<string>} - Array of item IDs to delete
 */
export const findRegexMatchingItems = (documentState, pattern, flags = 'gi') => {
    const matchingItemIds = [];

    if (!documentState?.pages || !pattern) return matchingItemIds;

    try {
        const regex = new RegExp(pattern, flags);

        for (const page of documentState.pages) {
            for (const item of page.items || []) {
                if (item.type === 'text' && !item.deleted && item.content) {
                    if (regex.test(item.content)) {
                        matchingItemIds.push(item.id);
                    }
                }
            }
        }
    } catch (e) {
        console.error('[findRegexMatchingItems] Invalid regex:', e);
    }

    return matchingItemIds;
};

/**
 * Find all images/pictures in document (for AI description helper)
 * @param {Object} documentState - The document state with pages
 * @param {boolean} requireUrl - Only include items with imageUrl (default: true)
 * @returns {Array<Object>} - Array of image objects with id, imageUrl, classification, pageNumber
 */
export const findAllImages = (documentState, requireUrl = true) => {
    const images = [];

    if (!documentState?.pages) return images;

    for (const page of documentState.pages) {
        for (const item of page.items || []) {
            if ((item.type === 'image' || item.type === 'picture') && !item.deleted) {
                if (!requireUrl || item.imageUrl) {
                    images.push({
                        id: item.id,
                        imageUrl: item.imageUrl,
                        classification: item.classification || 'unclassified',
                        pageNumber: page.pageNumber,
                    });
                }
            }
        }
    }

    return images;
};

/**
 * Execute a local helper and return the item IDs to modify
 * @param {string} helperId - The helper ID
 * @param {Object} documentState - The document state with pages
 * @param {Object} options - Additional options (e.g., pattern for regex)
 * @returns {{ itemIds: Array<string>, message: string }}
 */
export const executeLocalHelper = (helperId, documentState, options = {}) => {
    switch (helperId) {
        case 'remove_logos': {
            const itemIds = findLogoItems(documentState);
            const message = itemIds.length > 0
                ? `${itemIds.length} logo(s) removed`
                : 'No logos found';
            return { itemIds, message };
        }

        case 'remove_empty': {
            const itemIds = findEmptyTextItems(documentState);
            const message = itemIds.length > 0
                ? `${itemIds.length} empty item(s) removed`
                : 'No empty items found';
            return { itemIds, message };
        }

        case 'delete_regex': {
            const { pattern, flags = 'gi' } = options;
            if (!pattern) {
                return { itemIds: [], message: 'No regex pattern provided' };
            }
            const itemIds = findRegexMatchingItems(documentState, pattern, flags);
            const message = itemIds.length > 0
                ? `${itemIds.length} item(s) matching pattern removed`
                : 'No items matching pattern found';
            return { itemIds, message };
        }

        default:
            return { itemIds: [], message: 'Unknown helper' };
    }
};

/**
 * Hook for using local helpers
 * Provides memoized functions for executing helpers and checking helper types.
 * 
 * @returns {Object} - Helper functions and utilities
 */
export default function useLocalHelper() {
    /**
     * Execute a local helper on document state
     * @param {string} helperId - The helper ID
     * @param {Object} documentState - The document state
     * @param {Object} options - Additional options
     * @returns {{ itemIds: Array<string>, message: string }}
     */
    const execute = useCallback((helperId, documentState, options = {}) => {
        if (!isLocalHelper(helperId)) {
            return { itemIds: [], message: 'Not a local helper' };
        }
        return executeLocalHelper(helperId, documentState, options);
    }, []);

    /**
     * Check if a helper is local
     */
    const isLocal = useCallback((helperId) => {
        return isLocalHelper(helperId);
    }, []);

    /**
     * Find items that would be affected by a helper (preview)
     */
    const preview = useCallback((helperId, documentState, options = {}) => {
        return executeLocalHelper(helperId, documentState, options);
    }, []);

    /**
     * List of local helper IDs
     */
    const localHelpers = useMemo(() => LOCAL_HELPERS, []);

    return {
        execute,
        isLocal,
        preview,
        localHelpers,
        // Export individual finder functions for direct use
        findLogoItems,
        findEmptyTextItems,
        findRegexMatchingItems,
        findAllImages,
    };
}
