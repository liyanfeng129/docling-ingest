const axios = require('axios');

const ENGINE_URL = process.env.ENGINE_URL || 'http://localhost:8000';

const listCollections = async () => {
    const response = await axios.get(`${ENGINE_URL}/api/retrieval/collections`, {
        timeout: 30000,
    });
    return response.data;
};

const getCollectionInfo = async (collectionId) => {
    const response = await axios.get(`${ENGINE_URL}/api/retrieval/collection/${encodeURIComponent(collectionId)}/info`, {
        timeout: 30000,
    });
    return response.data;
};

const searchCollection = async ({ query, collectionId, k, enableReranking, rerankK }) => {
    const response = await axios.post(
        `${ENGINE_URL}/api/retrieval/search`,
        {
            query,
            collectionId,
            k,
            enableReranking,
            rerankK,
        },
        {
            timeout: 120000,
        }
    );

    return response.data;
};

module.exports = {
    listCollections,
    getCollectionInfo,
    searchCollection,
};
