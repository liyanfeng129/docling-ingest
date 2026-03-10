const express = require('express');
const multer = require('multer');
const router = express.Router();
const ingestionController = require('../controllers/ingestionController');

/**
 * Ingestion Routes
 * 
 * All routes are stateless - frontend manages document state in localStorage.
 * Backend only provides processing/AI functionality.
 */

// Configure multer for file upload (memory storage for processing)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        // Only allow PDF files
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed'), false);
        }
    }
});

// ============================================================================
// CONFIGURATION
// ============================================================================

// GET /api/ingestion/config - Get backend configuration
router.get('/config', ingestionController.getConfig);

// POST /api/ingestion/collection - Create new collection
router.post('/collection', ingestionController.createCollection);

// ============================================================================
// DOCUMENT PROCESSING
// ============================================================================

// POST /api/ingestion/upload - Upload document for content extraction
router.post('/upload', upload.single('file'), ingestionController.uploadDocument);

// ============================================================================
// EMBEDDING & INGESTION
// ============================================================================

// POST /api/ingestion/preview - Generate embedding preview from document state
router.post('/preview', ingestionController.previewEmbeddings);

// POST /api/ingestion/ingest - Ingest document into vector database
router.post('/ingest', ingestionController.startIngestion);

// ============================================================================
// AI HELPERS
// ============================================================================

// POST /api/ingestion/helper - Run AI helper on document content
router.post('/helper', ingestionController.runHelper);

// POST /api/ingestion/helper/image-descriptions - Generate AI descriptions for images
router.post('/helper/image-descriptions', ingestionController.generateImageDescriptions);

// POST /api/ingestion/helper/image-descriptions/stream - Stream AI descriptions (SSE)
router.post('/helper/image-descriptions/stream', ingestionController.streamImageDescriptions);

module.exports = router;
