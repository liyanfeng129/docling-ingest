/**
 * Ingestion API Service
 *
 * All API calls for the document ingestion feature.
 * Connects to the backend ingestion service at VITE_INGESTION_URL.
 *
 * Note: Frontend manages all document state in localStorage.
 * Backend is stateless and only provides processing/AI functionality.
 */

import axios from 'axios';
import { generateLocalPreview, isLocalStrategy } from '../hooks/useLocalStrategy';

// Ingestion service URL
const INGESTION_URL = import.meta.env.VITE_INGESTION_URL || 'http://localhost:4006';

// Create axios instance for ingestion service
const ingestionApi = axios.create({
    baseURL: INGESTION_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Get backend configuration (available DBs, image classes, etc.)
 * @returns {Promise<Object>} - The backend configuration
 */
export const getBackendConfig = async () => {
    const response = await ingestionApi.get('/api/ingestion/config');
    return response.data;
};

/**
 * Create a new ChromaDB collection
 * @param {string} name - Collection name (will be used as directory name)
 * @param {string} description - Optional description
 * @returns {Promise<{success: boolean, collection: Object, message: string}>}
 */
export const createCollection = async (name, description = null) => {
    const response = await ingestionApi.post('/api/ingestion/collection', {
        name,
        description,
    });
    return response.data;
};

// ============================================================================
// DOCUMENT PROCESSING
// ============================================================================

/**
 * Upload a document for processing
 * Returns extracted content directly - frontend caches in localStorage.
 *
 * @param {File} file - The file to upload
 * @param {Object} config - Optional processing configuration
 * @returns {Promise<{success: boolean, filename: string, content: Object}>}
 */
export const uploadDocument = async (file, config = {}) => {
    const formData = new FormData();
    formData.append('file', file);
    if (Object.keys(config).length > 0) {
        formData.append('config', JSON.stringify(config));
    }

    const response = await ingestionApi.post('/api/ingestion/upload', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });

    return response.data;
};

// ============================================================================
// EMBEDDING & INGESTION
// ============================================================================

/**
 * Preview embeddings that will be created from a document
 *
 * For LOCAL strategies (embed_per_page, chunked_fixed), preview is generated
 * in the frontend without calling backend.
 * For REMOTE strategies, calls backend API which proxies to engine.
 *
 * @param {string} strategy - The ingestion strategy
 * @param {Object} documentState - The current document state with pages
 * @returns {Promise<Object>} - Preview of embeddings to be created
 */
export const previewEmbeddings = async (strategy, documentState) => {
    // Check if this is a local strategy (handled in frontend)
    if (isLocalStrategy(strategy)) {
        // Generate preview locally using hook function
        const preview = generateLocalPreview(strategy, documentState);
        return { success: true, preview };
    }

    // For remote strategies, call backend API
    const response = await ingestionApi.post('/api/ingestion/preview', {
        strategy,
        documentState,
    });
    return response.data;
};

/**
 * Ingest document content into a vector database
 *
 * Accepts either pre-transformed documents array (from preview) or raw documentState.
 * If documentState is provided, it will be transformed to documents format.
 *
 * @param {string} targetDb - The target database ID
 * @param {Array|Object} documentsOrState - Either documents array from preview, or documentState
 * @param {string} strategy - The ingestion strategy
 * @param {Object} options - Additional options
 * @param {string} options.source - Source filename for metadata
 * @returns {Promise<{success: boolean, ...}>}
 */
export const startIngestion = async (targetDb, documentsOrState, strategy = 'embed_per_page', options = {}) => {
    let documents;
    let source = options.source || 'unknown';

    // Check if this is already a documents array (from preview) or raw documentState
    if (Array.isArray(documentsOrState)) {
        // Already transformed documents array
        documents = documentsOrState;
    } else if (documentsOrState?.pages) {
        // Raw documentState - transform it locally
        const preview = generateLocalPreview(strategy, documentsOrState);
        documents = preview.documents;
        source = documentsOrState.filename || source;
    } else {
        throw new Error('Invalid input: expected documents array or documentState with pages');
    }

    const response = await ingestionApi.post('/api/ingestion/ingest', {
        targetDb,
        documents,
        strategy,
        source,
    });
    return response.data;
};

// ============================================================================
// AI HELPERS
// ============================================================================

/**
 * Generate AI descriptions for images (batch - waits for all)
 * Sends document ID and image data to backend for AI processing
 * @param {string} documentId - The document ID
 * @param {Array} images - Array of { id, imageUrl, classification, pageNumber }
 * @returns {Promise<{success: boolean, descriptions: Array<{imageId: string, description: string}>, message?: string}>}
 */
export const generateImageDescriptions = async (documentId, images) => {
    const response = await ingestionApi.post('/api/ingestion/helper/image-descriptions', {
        documentId,
        images,
    });
    return response.data;
};

/**
 * Stream AI descriptions for images (SSE - real-time updates)
 * Each description is received immediately when generated
 *
 * @param {string} documentId - The document ID
 * @param {Array} images - Array of { id, imageUrl, classification, pageNumber }
 * @param {Object} callbacks - Event handlers
 * @param {Function} callbacks.onStart - Called when streaming starts: (total, documentId) => void
 * @param {Function} callbacks.onDescription - Called for each description: (imageId, classification, description) => void
 * @param {Function} callbacks.onError - Called on error: (error, imageId?) => void
 * @param {Function} callbacks.onDone - Called when complete: (success, total) => void
 * @returns {Promise<void>}
 */
export const streamImageDescriptions = async (documentId, images, callbacks = {}) => {
    const { onStart, onDescription, onError, onDone } = callbacks;
    const baseUrl = import.meta.env.VITE_INGESTION_URL || 'http://localhost:4006';

    return new Promise((resolve, reject) => {
        // Use fetch with POST to get SSE stream
        fetch(`${baseUrl}/api/ingestion/helper/image-descriptions/stream`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ documentId, images }),
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';

                const processText = (text) => {
                    buffer += text;
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || ''; // Keep incomplete line in buffer

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            try {
                                const data = JSON.parse(line.slice(6));

                                switch (data.type) {
                                    case 'start':
                                        onStart?.(data.total, data.documentId);
                                        break;
                                    case 'description':
                                        onDescription?.(data.imageId, data.classification, data.description);
                                        break;
                                    case 'error':
                                        onError?.(data.error, data.imageId);
                                        break;
                                    case 'done':
                                        onDone?.(data.success, data.total);
                                        resolve();
                                        return;
                                }
                            } catch (e) {
                                console.error('[streamImageDescriptions] Parse error:', e);
                            }
                        }
                    }
                };

                const pump = () => {
                    reader.read().then(({ done, value }) => {
                        if (done) {
                            // Process any remaining buffer
                            if (buffer) processText('');
                            resolve();
                            return;
                        }
                        processText(decoder.decode(value, { stream: true }));
                        pump();
                    }).catch(err => {
                        onError?.(err.message);
                        reject(err);
                    });
                };

                pump();
            })
            .catch(err => {
                onError?.(err.message);
                reject(err);
            });
    });
};

// Export all functions as named exports
export default {
    getBackendConfig,
    createCollection,
    uploadDocument,
    previewEmbeddings,
    startIngestion,
    generateImageDescriptions,
    streamImageDescriptions,
};
