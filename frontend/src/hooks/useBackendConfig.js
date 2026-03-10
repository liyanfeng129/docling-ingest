/**
 * useBackendConfig Hook
 * 
 * Fetches and caches dynamic configuration from the backend.
 * Uses module-level cache to prevent duplicate requests across components.
 * 
 * @example
 * const { config, loading, error, refetch } = useBackendConfig();
 * 
 * // Access config data
 * config.availableTargetDbs
 * config.availableImageClasses
 * config.embeddingModels
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getBackendConfig } from '../services/ingestionApi';

// Module-level cache to share config across all hook instances
let cachedConfig = null;
let cacheTimestamp = 0;
let fetchPromise = null;
const CACHE_TTL_MS = 30000; // 30 seconds cache

/**
 * Custom hook for fetching backend configuration
 * Shares cache across all component instances to prevent duplicate requests.
 * 
 * @returns {Object} - { config, loading, error, refetch }
 */
const useBackendConfig = () => {
    const [config, setConfig] = useState(cachedConfig);
    const [loading, setLoading] = useState(!cachedConfig);
    const [error, setError] = useState(null);
    const mountedRef = useRef(true);

    /**
     * Fetch configuration from backend with caching
     */
    const fetchConfig = useCallback(async (forceRefresh = false) => {
        const now = Date.now();

        // Return cached config if valid and not forcing refresh
        if (!forceRefresh && cachedConfig && (now - cacheTimestamp) < CACHE_TTL_MS) {
            setConfig(cachedConfig);
            setLoading(false);
            return;
        }

        // If a fetch is already in progress, wait for it
        if (fetchPromise) {
            try {
                const data = await fetchPromise;
                if (mountedRef.current) {
                    setConfig(data);
                    setLoading(false);
                }
                return;
            } catch (err) {
                if (mountedRef.current) {
                    setError(err.message || 'Failed to load configuration');
                    setLoading(false);
                }
                return;
            }
        }

        setLoading(true);
        setError(null);

        // Create a new fetch promise
        fetchPromise = getBackendConfig();

        try {
            const data = await fetchPromise;

            // Update module-level cache
            cachedConfig = data;
            cacheTimestamp = Date.now();

            if (mountedRef.current) {
                setConfig(data);
            }
        } catch (err) {
            console.error('Failed to fetch backend config:', err);
            if (mountedRef.current) {
                setError(err.message || 'Failed to load configuration');
            }
        } finally {
            fetchPromise = null;
            if (mountedRef.current) {
                setLoading(false);
            }
        }
    }, []);

    // Fetch on mount
    useEffect(() => {
        mountedRef.current = true;
        fetchConfig();

        return () => {
            mountedRef.current = false;
        };
    }, [fetchConfig]);

    /**
     * Manually refetch configuration (bypasses cache)
     */
    const refetch = useCallback(() => {
        return fetchConfig(true);
    }, [fetchConfig]);

    return {
        config,
        loading,
        error,
        refetch,
    };
};

export default useBackendConfig;
