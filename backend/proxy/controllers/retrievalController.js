const retrievalService = require('../services/retrievalService');

const listCollections = async (req, res) => {
    try {
        const response = await retrievalService.listCollections();
        res.json(response);
    } catch (error) {
        console.error('[Retrieval] list collections error:', error.message);
        const status = error.response?.status || 500;
        res.status(status).json({
            success: false,
            error: error.response?.data?.detail || 'Failed to list collections',
        });
    }
};

const getCollectionInfo = async (req, res) => {
    try {
        const { collectionId } = req.params;
        if (!collectionId) {
            return res.status(400).json({ success: false, error: 'collectionId is required' });
        }

        const response = await retrievalService.getCollectionInfo(collectionId);
        return res.json(response);
    } catch (error) {
        console.error('[Retrieval] get collection info error:', error.message);
        const status = error.response?.status || 500;
        return res.status(status).json({
            success: false,
            error: error.response?.data?.detail || 'Failed to get collection info',
        });
    }
};

const search = async (req, res) => {
    try {
        const {
            query,
            collectionId,
            k = 8,
            enableReranking = false,
            rerankK = 3,
        } = req.body;

        if (!query || typeof query !== 'string' || !query.trim()) {
            return res.status(400).json({ success: false, error: 'query is required' });
        }

        if (!collectionId || typeof collectionId !== 'string' || !collectionId.trim()) {
            return res.status(400).json({ success: false, error: 'collectionId is required' });
        }

        if (!Number.isInteger(k) || k < 1 || k > 50) {
            return res.status(400).json({ success: false, error: 'k must be an integer between 1 and 50' });
        }

        if (!Number.isInteger(rerankK) || rerankK < 1 || rerankK > 20) {
            return res.status(400).json({ success: false, error: 'rerankK must be an integer between 1 and 20' });
        }

        const response = await retrievalService.searchCollection({
            query: query.trim(),
            collectionId: collectionId.trim(),
            k,
            enableReranking: Boolean(enableReranking),
            rerankK,
        });

        return res.json(response);
    } catch (error) {
        console.error('[Retrieval] search error:', error.message);
        const status = error.response?.status || 500;
        return res.status(status).json({
            success: false,
            error: error.response?.data?.detail || 'Search failed',
        });
    }
};

module.exports = {
    listCollections,
    getCollectionInfo,
    search,
};
