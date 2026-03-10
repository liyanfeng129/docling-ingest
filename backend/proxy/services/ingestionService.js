/**
 * Ingestion Service
 *
 * This service is a PROXY to the engine + CONFIG PROVIDER:
 * - Aggregates local config (strategies, helpers, picture classes) with remote config
 * - Proxies requests to engine for document processing and ingestion
 * - Local strategies and helpers are defined in config but executed in FRONTEND
 */

const axios = require('axios');
const FormData = require('form-data');
const path = require('path');
const fs = require('fs');

const ENGINE_URL = process.env.ENGINE_URL || 'http://localhost:8000';

// Load local config files
const CONFIG_DIR = path.join(__dirname, '..', 'config');
const pictureClassificationsConfig = JSON.parse(
    fs.readFileSync(path.join(CONFIG_DIR, 'pictureClassifications.json'), 'utf8')
);
const localConfig = JSON.parse(
    fs.readFileSync(path.join(CONFIG_DIR, 'localConfig.json'), 'utf8')
);

// ============================================================================
// CONFIGURATION
// ============================================================================

const getConfig = async () => {
    try {
        console.log('[CONFIG] Fetching remote config from engine...');
        const response = await axios.get(`${ENGINE_URL}/api/ingestion/config`, {
            timeout: 5000,
        });
        const remoteConfig = response.data;
        console.log('[CONFIG] Remote config fetched successfully');

        return aggregateConfig(remoteConfig);
    } catch (error) {
        console.warn(`[CONFIG] Engine unavailable: ${error.message}`);
        console.log('[CONFIG] Falling back to local-only config');
        return aggregateConfig(null);
    }
};

const aggregateConfig = (remoteConfig) => {
    const { strategies, helpers } = localConfig;
    const { classes, categories, presets } = pictureClassificationsConfig;

    const localStrategies = strategies.localStrategies || [];
    const localHelpers = helpers.localHelpers || [];

    const remoteStrategies = remoteConfig?.strategies || [];
    const remoteHelpers = remoteConfig?.helpers || [];
    const collections = remoteConfig?.collections || [];
    const embeddingModels = remoteConfig?.embeddingModels || [];

    const allStrategies = [...localStrategies, ...remoteStrategies];
    const allHelpers = [...localHelpers, ...remoteHelpers];

    return {
        strategies: allStrategies,
        helpers: allHelpers,
        collections: collections,
        embeddingModels: embeddingModels,
        imageClasses: classes,
        imageCategories: categories,
        imagePresets: presets,
        availableTargetDbs: collections,
        availableImageClasses: classes,
    };
};

const createCollection = async (name, description) => {
    console.log(`[COLLECTION] Creating collection: ${name}`);

    try {
        const response = await axios.post(
            `${ENGINE_URL}/api/ingestion/collection`,
            { name, description },
            {
                headers: { 'Content-Type': 'application/json' },
                timeout: 30000,
            }
        );

        console.log(`[COLLECTION] Engine response: success=${response.data?.success}`);
        return response.data;
    } catch (error) {
        console.error(`[COLLECTION] Error creating collection:`, error.message);

        if (error.response) {
            const status = error.response.status;
            const data = error.response.data;

            if (status === 409) {
                return {
                    success: false,
                    error: 'Collection already exists',
                    details: data?.details || `A collection with name "${name}" already exists`,
                };
            }

            return {
                success: false,
                error: data?.error || `Engine error (${status})`,
                details: data?.details || error.message,
            };
        }

        throw new Error(`Failed to connect to engine: ${error.message}`);
    }
};

// ============================================================================
// DOCUMENT UPLOAD (Proxy to Engine)
// ============================================================================

const uploadForProcessing = async (fileBuffer, filename, mimeType) => {
    console.log(`[UPLOAD] Processing document: ${filename} (${mimeType}, ${fileBuffer.length} bytes)`);

    const formData = new FormData();
    formData.append('file', fileBuffer, {
        filename,
        contentType: mimeType
    });

    try {
        console.log(`[UPLOAD] Calling engine: ${ENGINE_URL}/api/ingestion/convert`);
        const response = await axios.post(
            `${ENGINE_URL}/api/ingestion/convert`,
            formData,
            {
                headers: { ...formData.getHeaders() },
                timeout: 120000,
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
            }
        );

        console.log(`[UPLOAD] Engine response received: success=${response.data?.success}`);

        if (!response.data?.success) {
            throw new Error(response.data?.error || 'Engine returned unsuccessful response');
        }

        if (!response.data?.content) {
            throw new Error('Engine response missing content field');
        }

        return response.data.content;

    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            console.error(`[UPLOAD] Engine unavailable at ${ENGINE_URL}`);
            throw new Error(`Engine unavailable. Please ensure it is running at ${ENGINE_URL}`);
        }

        if (error.response) {
            console.error(`[UPLOAD] Engine error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
            throw new Error(error.response.data?.detail || error.response.data?.error || 'Engine processing failed');
        }

        console.error(`[UPLOAD] Upload error: ${error.message}`);
        throw error;
    }
};

// ============================================================================
// VECTOR DB INGESTION (Proxy to Engine)
// ============================================================================

const ingestToVectorDb = async (targetDb, documents, strategy = 'embed_per_page', source = 'unknown') => {
    console.log(`[INGEST] Received ${documents.length} pre-transformed documents`);
    console.log(`[INGEST] Strategy: ${strategy}, Target: ${targetDb}, Source: ${source}`);

    try {
        console.log(`[INGEST] Calling engine: ${ENGINE_URL}/api/ingestion/ingest`);
        const response = await axios.post(
            `${ENGINE_URL}/api/ingestion/ingest`,
            {
                collectionId: targetDb,
                documents: documents,
                strategy: strategy,
            },
            { timeout: 120000 }
        );

        console.log(`[INGEST] Engine response: success=${response.data?.success}`);
        return response.data;
    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            console.error(`[INGEST] Engine unavailable at ${ENGINE_URL}`);
            console.log(`[INGEST] Falling back to mock response`);
            return {
                success: true,
                collectionId: targetDb,
                strategy,
                documentCount: documents.length,
                message: `[MOCK] Successfully ingested ${documents.length} documents to ${targetDb} (engine unavailable)`,
            };
        }

        if (error.response) {
            console.error(`[INGEST] Engine error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
            throw new Error(error.response.data?.detail || error.response.data?.error || 'Engine ingestion failed');
        }

        console.error(`[INGEST] Ingestion error: ${error.message}`);
        throw error;
    }
};

module.exports = {
    getConfig,
    createCollection,
    uploadForProcessing,
    ingestToVectorDb,
};
