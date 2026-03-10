/**
 * useLocalCache Hook
 * 
 * A hook for persisting state to localStorage with debouncing.
 * Provides auto-save, load, and clear functionality.
 * 
 * @example
 * // Auto-save state changes
 * useLocalCache(editState, 'ingestion_edit_state');
 * 
 * // Load cached state
 * const cached = loadFromCache('ingestion_edit_state');
 * 
 * // Clear cached state
 * clearCache('ingestion_edit_state');
 */

import { useEffect, useRef, useCallback } from 'react';
import { INGESTION_CONFIG } from '../config/ingestionConfig';

// Warn threshold (4.5MB out of 5MB typical quota)
const STORAGE_WARN_THRESHOLD = 4.5 * 1024 * 1024;

/**
 * Get approximate localStorage usage in bytes
 * @returns {number} - Approximate bytes used
 */
const getStorageUsage = () => {
    let total = 0;
    try {
        for (const key in localStorage) {
            if (Object.prototype.hasOwnProperty.call(localStorage, key)) {
                total += localStorage[key].length * 2; // UTF-16 = 2 bytes per char
            }
        }
    } catch (e) {
        console.warn('Could not calculate storage usage:', e);
    }
    return total;
};

/**
 * Check if approaching storage quota
 * @returns {boolean} - True if nearing quota
 */
const isNearingQuota = () => {
    return getStorageUsage() > STORAGE_WARN_THRESHOLD;
};

/**
 * Safely parse JSON from localStorage
 * @param {string} key - The storage key
 * @returns {any} - Parsed value or null
 */
export const loadFromCache = (key) => {
    try {
        const item = localStorage.getItem(key);
        if (item === null) return null;
        return JSON.parse(item);
    } catch (error) {
        console.error(`Error loading from cache (${key}):`, error);
        return null;
    }
};

/**
 * Save value to localStorage
 * @param {string} key - The storage key
 * @param {any} value - The value to store
 * @returns {boolean} - True if successful
 */
export const saveToCache = (key, value) => {
    try {
        const serialized = JSON.stringify(value);
        localStorage.setItem(key, serialized);

        // Warn if nearing quota
        if (isNearingQuota()) {
            console.warn('localStorage is nearing quota limit');
        }

        return true;
    } catch (error) {
        if (error.name === 'QuotaExceededError') {
            console.error('localStorage quota exceeded');
        } else {
            console.error(`Error saving to cache (${key}):`, error);
        }
        return false;
    }
};

/**
 * Clear a specific key from localStorage
 * @param {string} key - The storage key
 */
export const clearCache = (key) => {
    try {
        localStorage.removeItem(key);
    } catch (error) {
        console.error(`Error clearing cache (${key}):`, error);
    }
};

/**
 * Check if cache exists for a key
 * @param {string} key - The storage key
 * @returns {boolean} - True if cache exists
 */
export const hasCache = (key) => {
    return localStorage.getItem(key) !== null;
};

/**
 * Get all keys matching a prefix
 * @param {string} prefix - The prefix to match
 * @returns {string[]} - Array of matching keys
 */
export const getKeysWithPrefix = (prefix) => {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
            keys.push(key);
        }
    }
    return keys;
};

/**
 * Clear all keys matching a prefix
 * @param {string} prefix - The prefix to match
 * @returns {number} - Number of keys cleared
 */
export const clearKeysWithPrefix = (prefix) => {
    const keys = getKeysWithPrefix(prefix);
    keys.forEach(key => localStorage.removeItem(key));
    return keys.length;
};

/**
 * Get storage usage for keys matching a prefix
 * @param {string} prefix - The prefix to match
 * @returns {number} - Bytes used
 */
export const getStorageUsageForPrefix = (prefix) => {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
            const value = localStorage.getItem(key);
            total += (key.length + (value?.length || 0)) * 2; // UTF-16
        }
    }
    return total;
};

/**
 * Get cache metadata (timestamp, etc.)
 * @param {string} key - The storage key
 * @returns {Object|null} - Metadata or null
 */
export const getCacheMetadata = (key) => {
    const data = loadFromCache(key);
    if (data && data._metadata) {
        return data._metadata;
    }
    return null;
};

/**
 * Custom hook for auto-saving state to localStorage with debounce
 * 
 * @param {any} state - The state to cache
 * @param {string} key - The localStorage key
 * @param {Object} options - Optional configuration
 * @param {number} options.debounceMs - Debounce delay (default from config)
 * @param {boolean} options.enabled - Whether caching is enabled (default true)
 */
const useLocalCache = (state, key, options = {}) => {
    const {
        debounceMs = INGESTION_CONFIG.ui.autoSaveDebounceMs,
        enabled = true,
    } = options;

    const timeoutRef = useRef(null);
    const previousStateRef = useRef(null);

    // Save with debounce
    const debouncedSave = useCallback((value) => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
            // Add metadata to cached value
            const valueWithMetadata = {
                ...value,
                _metadata: {
                    savedAt: new Date().toISOString(),
                    version: 1,
                },
            };

            const success = saveToCache(key, valueWithMetadata);
            if (success) {
                console.debug(`[useLocalCache] Saved to ${key}`);
            }
        }, debounceMs);
    }, [key, debounceMs]);

    // Effect to save state changes
    useEffect(() => {
        if (!enabled) return;

        // Skip if state hasn't changed
        const stateStr = JSON.stringify(state);
        if (stateStr === previousStateRef.current) return;
        previousStateRef.current = stateStr;

        // Don't save null/undefined states
        if (state === null || state === undefined) return;

        debouncedSave(state);

        // Cleanup timeout on unmount
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [state, enabled, debouncedSave]);

    // Return utility functions
    return {
        load: () => loadFromCache(key),
        save: (value) => saveToCache(key, value),
        clear: () => clearCache(key),
        hasCache: () => hasCache(key),
    };
};

export default useLocalCache;
