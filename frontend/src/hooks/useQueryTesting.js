import { useCallback, useReducer } from 'react';
import { getCollectionInfo, getRetrievalCollections, searchCollection } from '../services/retrievalApi';

const HISTORY_LIMIT = 20;

const initialState = {
    query: '',
    collectionId: '',
    collections: [],
    collectionInfo: null,
    params: {
        k: 8,
        enableReranking: false,
        rerankK: 3,
    },
    results: [],
    timing: null,
    observability: null,
    isSearching: false,
    isLoadingCollections: false,
    error: null,
    searchHistory: [],
};

function reducer(state, action) {
    switch (action.type) {
        case 'SET_QUERY':
            return { ...state, query: action.payload };
        case 'SET_COLLECTION_ID':
            return { ...state, collectionId: action.payload };
        case 'SET_COLLECTIONS_LOADING':
            return { ...state, isLoadingCollections: action.payload };
        case 'SET_COLLECTIONS':
            return {
                ...state,
                collections: action.payload,
                collectionId: state.collectionId || action.payload[0]?.id || '',
            };
        case 'SET_COLLECTION_INFO':
            return { ...state, collectionInfo: action.payload };
        case 'UPDATE_PARAMS':
            return {
                ...state,
                params: {
                    ...state.params,
                    ...action.payload,
                },
            };
        case 'SEARCH_START':
            return { ...state, isSearching: true, error: null };
        case 'SEARCH_SUCCESS':
            return {
                ...state,
                isSearching: false,
                error: null,
                results: action.payload.results,
                timing: action.payload.timing,
                observability: action.payload.observability,
                searchHistory: action.payload.searchHistory,
            };
        case 'SEARCH_ERROR':
            return { ...state, isSearching: false, error: action.payload };
        case 'CLEAR_RESULTS':
            return { ...state, results: [], timing: null, observability: null, error: null };
        default:
            return state;
    }
}

function createHistoryEntry({ query, collectionId, params, resultCount, timing }) {
    return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        query,
        collectionId,
        params,
        resultCount,
        totalMs: timing?.totalMs ?? 0,
        createdAt: new Date().toISOString(),
    };
}

export default function useQueryTesting() {
    const [state, dispatch] = useReducer(reducer, initialState);

    const setQuery = useCallback((query) => {
        dispatch({ type: 'SET_QUERY', payload: query });
    }, []);

    const setCollectionId = useCallback((collectionId) => {
        dispatch({ type: 'SET_COLLECTION_ID', payload: collectionId });
    }, []);

    const updateParams = useCallback((params) => {
        dispatch({ type: 'UPDATE_PARAMS', payload: params });
    }, []);

    const loadCollections = useCallback(async () => {
        dispatch({ type: 'SET_COLLECTIONS_LOADING', payload: true });
        try {
            const response = await getRetrievalCollections();
            const collections = response?.collections || [];
            dispatch({ type: 'SET_COLLECTIONS', payload: collections });
            if (collections.length > 0) {
                const defaultId = state.collectionId || collections[0].id;
                const info = await getCollectionInfo(defaultId);
                dispatch({ type: 'SET_COLLECTION_INFO', payload: info?.collection || null });
            } else {
                dispatch({ type: 'SET_COLLECTION_INFO', payload: null });
            }
        } catch (error) {
            dispatch({ type: 'SEARCH_ERROR', payload: error.response?.data?.error || error.message || 'Failed to load collections' });
        } finally {
            dispatch({ type: 'SET_COLLECTIONS_LOADING', payload: false });
        }
    }, [state.collectionId]);

    const loadCollectionInfo = useCallback(async (collectionId) => {
        if (!collectionId) {
            dispatch({ type: 'SET_COLLECTION_INFO', payload: null });
            return;
        }
        try {
            const response = await getCollectionInfo(collectionId);
            dispatch({ type: 'SET_COLLECTION_INFO', payload: response?.collection || null });
        } catch (error) {
            dispatch({ type: 'SEARCH_ERROR', payload: error.response?.data?.error || error.message || 'Failed to load collection info' });
        }
    }, []);

    const executeSearch = useCallback(async (overrides = null) => {
        const query = overrides?.query ?? state.query;
        const collectionId = overrides?.collectionId ?? state.collectionId;
        const params = overrides?.params ?? state.params;
        const skipHistory = overrides?.skipHistory ?? false;

        if (!query?.trim()) {
            dispatch({ type: 'SEARCH_ERROR', payload: 'Query is required' });
            return null;
        }
        if (!collectionId) {
            dispatch({ type: 'SEARCH_ERROR', payload: 'Please select a collection' });
            return null;
        }

        dispatch({ type: 'SEARCH_START' });

        try {
            const response = await searchCollection(query.trim(), collectionId, params);
            const results = response?.results || [];
            const timing = response?.timing || null;
            const observability = response?.observability || null;

            let nextHistory = state.searchHistory;
            if (!skipHistory) {
                const historyEntry = createHistoryEntry({
                    query: query.trim(),
                    collectionId,
                    params,
                    resultCount: results.length,
                    timing,
                });

                const existingIdx = state.searchHistory.findIndex(
                    (h) => h.query === query.trim() && h.collectionId === collectionId
                );

                if (existingIdx >= 0) {
                    nextHistory = [...state.searchHistory];
                    nextHistory[existingIdx] = historyEntry;
                } else {
                    nextHistory = [historyEntry, ...state.searchHistory].slice(0, HISTORY_LIMIT);
                }
            }

            dispatch({
                type: 'SEARCH_SUCCESS',
                payload: {
                    results,
                    timing,
                    observability,
                    searchHistory: nextHistory,
                },
            });

            return response;
        } catch (error) {
            dispatch({
                type: 'SEARCH_ERROR',
                payload: error.response?.data?.error || error.response?.data?.detail || error.message || 'Search failed',
            });
            return null;
        }
    }, [state.collectionId, state.params, state.query, state.searchHistory]);

    const runHistoryEntry = useCallback(async (entry) => {
        dispatch({ type: 'SET_QUERY', payload: entry.query });
        dispatch({ type: 'SET_COLLECTION_ID', payload: entry.collectionId });
        dispatch({ type: 'UPDATE_PARAMS', payload: entry.params });
        await loadCollectionInfo(entry.collectionId);
        return executeSearch({ query: entry.query, collectionId: entry.collectionId, params: entry.params, skipHistory: true });
    }, [executeSearch, loadCollectionInfo]);

    const clearResults = useCallback(() => {
        dispatch({ type: 'CLEAR_RESULTS' });
    }, []);

    return {
        ...state,
        setQuery,
        setCollectionId,
        updateParams,
        loadCollections,
        loadCollectionInfo,
        executeSearch,
        runHistoryEntry,
        clearResults,
    };
}
