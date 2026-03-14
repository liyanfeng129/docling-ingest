import axios from 'axios';

const INGESTION_URL = import.meta.env.VITE_INGESTION_URL || 'http://localhost:4006';
const retrievalApi = axios.create({
    baseURL: INGESTION_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

export const searchCollection = async (query, collectionId, params = {}) => {
    const response = await retrievalApi.post('/api/retrieval/search', {
        query,
        collectionId,
        k: params.k ?? 8,
        enableReranking: params.enableReranking ?? false,
        rerankK: params.rerankK ?? 3,
    });
    return response.data;
};

export const getRetrievalCollections = async () => {
    const response = await retrievalApi.get('/api/retrieval/collections');
    return response.data;
};

export const getCollectionInfo = async (collectionId) => {
    const response = await retrievalApi.get(`/api/retrieval/collection/${encodeURIComponent(collectionId)}/info`);
    return response.data;
};
