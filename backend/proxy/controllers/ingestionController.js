const ingestionService = require('../services/ingestionService');
const contentViewerService = require('../services/contentViewerService');

/**
 * Ingestion Controller
 * 
 * Handles HTTP requests for document ingestion operations.
 * 
 * Architecture:
 * - All document state is managed by frontend (localStorage)
 * - Local strategies/helpers are executed in frontend
 * - This controller proxies to LLM service for remote operations
 * - Configuration is aggregated from local config + LLM service
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * GET /api/ingestion/config
 * Get backend configuration (strategies, helpers, collections, image classes)
 * 
 * Aggregates local config (localConfig.json) with remote config from LLM service.
 */
const getConfig = async (req, res) => {
    try {
        const config = await ingestionService.getConfig();
        res.json(config);
    } catch (error) {
        console.error('Config error:', error);
        res.status(500).json({ error: 'Failed to get config', details: error.message });
    }
};

/**
 * POST /api/ingestion/collection
 * Create a new ChromaDB collection
 * 
 * Proxies to LLM service /api/ingestion/collection.
 */
const createCollection = async (req, res) => {
    try {
        const { name, description } = req.body;

        if (!name || typeof name !== 'string' || !name.trim()) {
            return res.status(400).json({
                success: false,
                error: 'Collection name is required'
            });
        }

        // Validate name format (alphanumeric, underscores, hyphens only)
        const cleanName = name.trim().toLowerCase().replace(/\s+/g, '_');
        if (!/^[a-z0-9_-]+$/.test(cleanName)) {
            return res.status(400).json({
                success: false,
                error: 'Collection name can only contain letters, numbers, underscores, and hyphens'
            });
        }

        // Create collection via ingestion service (proxies to LLM service)
        const result = await ingestionService.createCollection(cleanName, description);
        res.json(result);
    } catch (error) {
        console.error('Create collection error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create collection',
            details: error.message
        });
    }
};

// ============================================================================
// DOCUMENT UPLOAD & PROCESSING (Proxy to LLM Service)
// ============================================================================

/**
 * POST /api/ingestion/upload
 * Upload a document for content extraction
 * 
 * Proxies to LLM service /api/ingestion/convert.
 * Returns extracted content immediately (no server-side state).
 * Frontend caches the result in localStorage.
 * 
 * Response format:
 * {
 *   success: true,
 *   filename: "document.pdf",
 *   content: {
 *     documentId: "doc_xxx",
 *     filename: "document.pdf",
 *     totalPages: 10,
 *     pages: [{ pageNumber: 1, items: [...] }, ...]
 *   },
 *   timing: { conversionSeconds, parseSeconds, totalSeconds }
 * }
 */
const uploadDocument = async (req, res) => {
    try {
        // Validate file was uploaded
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No file provided'
            });
        }

        const { originalname, mimetype, buffer } = req.file;

        // Validate file type
        const supportedTypes = ['application/pdf'];
        if (!supportedTypes.includes(mimetype)) {
            return res.status(400).json({
                success: false,
                error: `Unsupported file type: ${mimetype}. Supported: ${supportedTypes.join(', ')}`
            });
        }

        console.log(`[UPLOAD] Processing: ${originalname} (${mimetype}, ${buffer.length} bytes)`);

        // Process document through LLM service
        // Returns: { documentId, filename, totalPages, pages }
        const content = await ingestionService.uploadForProcessing(buffer, originalname, mimetype);

        // Validate response has required fields
        if (!content.pages || !Array.isArray(content.pages)) {
            console.error('[UPLOAD] Invalid response from LLM service: missing pages array');
            return res.status(500).json({
                success: false,
                error: 'Invalid response from document processor'
            });
        }

        console.log(`[UPLOAD] Success: ${content.totalPages} pages, ${content.pages.reduce((sum, p) => sum + (p.items?.length || 0), 0)} items`);

        // Return extracted content
        // Frontend will cache this in localStorage
        res.status(200).json({
            success: true,
            filename: originalname,
            content: {
                documentId: content.documentId || `doc_${Date.now()}`,
                filename: content.filename || originalname,
                totalPages: content.totalPages || content.pages.length,
                pages: content.pages
            }
        });
    } catch (error) {
        console.error('[UPLOAD] Error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Failed to process document',
            details: error.message
        });
    }
};

// ============================================================================
// EMBEDDING PREVIEW & INGESTION
// ============================================================================

/**
 * POST /api/ingestion/preview
 * Generate embedding preview from document content
 * 
 * NOTE: For local strategies (embed_per_page, chunked_fixed), this should be
 * handled in the FRONTEND. This endpoint is kept for remote/AI strategies
 * that require server-side processing.
 * 
 * TODO: Frontend should implement local preview generation and only call
 * this endpoint for remote strategies.
 */
const previewEmbeddings = async (req, res) => {
    try {
        const { documentState, strategy = 'embed_per_page' } = req.body;

        if (!documentState) {
            return res.status(400).json({ success: false, error: 'documentState is required' });
        }

        // For now, return a message indicating frontend should handle local strategies
        // TODO: Implement remote strategy preview via LLM service
        res.json({
            success: true,
            message: 'Preview should be generated in frontend for local strategies',
            preview: {
                source: documentState.filename || 'unknown',
                document_type: 'pdf',
                page_count: documentState.pages?.length || 0,
                total_embeddings: 0,
                strategy: strategy,
                documents: [],
            }
        });
    } catch (error) {
        console.error('Preview error:', error);
        res.status(500).json({ error: 'Failed to generate preview', details: error.message });
    }
};

/**
 * POST /api/ingestion/ingest
 * Ingest content into vector database
 * 
 * Proxies to LLM service /api/ingestion/ingest.
 * Receives pre-transformed documents array from frontend.
 */
const startIngestion = async (req, res) => {
    try {
        const { targetDb, documents, strategy = 'embed_per_page', source = 'unknown' } = req.body;

        if (!targetDb) {
            return res.status(400).json({ error: 'targetDb is required' });
        }

        if (!documents || !Array.isArray(documents)) {
            return res.status(400).json({ error: 'documents array is required' });
        }

        // Ingest to vector database via LLM service
        const result = await ingestionService.ingestToVectorDb(targetDb, documents, strategy, source);

        res.status(200).json({
            success: true,
            ...result
        });
    } catch (error) {
        console.error('Ingestion error:', error);
        res.status(500).json({ error: 'Failed to ingest content', details: error.message });
    }
};

// ============================================================================
// AI HELPERS (Proxy to LLM Service)
// ============================================================================

/**
 * POST /api/ingestion/helper
 * Run a backend AI helper function
 * 
 * NOTE: Local helpers (remove_logos, remove_decorative, etc.) are executed
 * in the FRONTEND. This endpoint is for remote AI helpers only.
 */
const runHelper = async (req, res) => {
    try {
        const { helperId, content, params = {} } = req.body;

        if (!helperId) {
            return res.status(400).json({ error: 'helperId is required' });
        }

        if (!content) {
            return res.status(400).json({ error: 'content is required' });
        }

        // Run helper via content viewer service (proxies to LLM service)
        const result = await contentViewerService.runAiHelper(helperId, content, params);
        res.json(result);
    } catch (error) {
        console.error('Helper error:', error);
        res.status(500).json({ error: 'Failed to run helper', details: error.message });
    }
};

/**
 * POST /api/ingestion/helper/image-descriptions
 * Generate AI descriptions for images
 * 
 * Proxies to LLM service for AI vision processing.
 */
const generateImageDescriptions = async (req, res) => {
    try {
        const { documentId, images } = req.body;

        if (!documentId) {
            return res.status(400).json({ success: false, error: 'documentId is required' });
        }

        if (!images || !Array.isArray(images) || images.length === 0) {
            return res.status(400).json({ success: false, error: 'images array is required' });
        }

        // Generate descriptions via content viewer service (proxies to LLM service)
        const result = await contentViewerService.generateImageDescriptionsFromImages(documentId, images);
        res.json(result);
    } catch (error) {
        console.error('Image descriptions error:', error);
        res.status(500).json({ success: false, error: 'Failed to generate image descriptions', details: error.message });
    }
};

/**
 * POST /api/ingestion/helper/image-descriptions/stream
 * Stream AI descriptions for images via SSE
 * 
 * Each description is sent immediately when generated.
 * Frontend receives events and can update UI progressively.
 */
const streamImageDescriptions = async (req, res) => {
    try {
        const { documentId, images } = req.body;

        if (!documentId) {
            res.setHeader('Content-Type', 'text/event-stream');
            res.write(`data: ${JSON.stringify({ type: 'error', error: 'documentId is required' })}\n\n`);
            return res.end();
        }

        if (!images || !Array.isArray(images) || images.length === 0) {
            res.setHeader('Content-Type', 'text/event-stream');
            res.write(`data: ${JSON.stringify({ type: 'error', error: 'images array is required' })}\n\n`);
            return res.end();
        }

        // Stream descriptions via content viewer service
        await contentViewerService.streamImageDescriptions(documentId, images, res);
    } catch (error) {
        console.error('Image descriptions stream error:', error);
        // Try to send error via SSE if headers not sent
        if (!res.headersSent) {
            res.setHeader('Content-Type', 'text/event-stream');
        }
        res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
        res.end();
    }
};

module.exports = {
    getConfig,
    createCollection,
    uploadDocument,
    previewEmbeddings,
    startIngestion,
    runHelper,
    generateImageDescriptions,
    streamImageDescriptions,
};
