/**
 * useLocalStrategy Hook
 * 
 * Handles local (frontend-only) embedding strategies that don't require backend processing.
 * Strategies: embed_per_page, chunked_fixed, chunked_document
 * 
 * @see doc/ingestion/API_CONTRACTS.md
 */

// Note: React hooks removed - this file now only exports pure functions

/**
 * LOCAL STRATEGIES - IDs that are handled in frontend
 * These strategies do not require backend processing
 */
export const LOCAL_STRATEGIES = ['embed_per_page', 'chunked_fixed', 'chunked_document'];

/**
 * Generate a simple hash from a string for unique ID generation
 * @param {string} str - The string to hash
 * @returns {string} - A short hash string
 */
const simpleHash = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36).substring(0, 8);
};

/**
 * Generate page-based embeddings (one embedding per page)
 * @param {Object} documentState - The document state with pages
 * @param {string} fileHash - Unique hash for the file
 * @param {string} filename - The filename
 * @returns {Array} - Array of document objects for embedding
 */
const generatePageEmbeddings = (documentState, fileHash, filename) => {
    const documents = [];

    (documentState.pages || []).forEach((page, idx) => {
        const pageNum = page.pageNumber || idx + 1;
        const activeItems = (page.items || []).filter(item => !item.deleted);

        // Combine all text content from the page
        const textContent = activeItems
            .filter(item => item.type === 'text')
            .map(item => item.content)
            .join('\n\n');

        // Gather image data
        const images = activeItems
            .filter(item => item.type === 'image')
            .map(item => ({
                uuid: item.id,
                imageUrl: item.imageUrl,
                imageWidth: item.imageWidth,
                imageHeight: item.imageHeight,
                classification: item.classification || 'unknown',
                description: item.description,
            }));

        // Gather table data as markdown
        const tableContent = activeItems
            .filter(item => item.type === 'table')
            .map(item => {
                if (!item.tableData) return '';
                const headers = item.tableData.headers?.join(' | ') || '';
                const separator = item.tableData.headers?.map(() => '---').join(' | ') || '';
                const rows = item.tableData.rows?.map(row => row.join(' | ')).join('\n| ') || '';
                return `| ${headers} |\n| ${separator} |\n| ${rows} |`;
            })
            .filter(Boolean)
            .join('\n\n');

        const tables = activeItems
            .filter(item => item.type === 'table')
            .map(item => ({
                id: item.id,
                tableData: item.tableData,
            }));

        const fullContent = [textContent, tableContent].filter(Boolean).join('\n\n');

        if (fullContent.trim() || images.length > 0) {
            documents.push({
                // Include fileHash in ID to make it unique across different files
                id: `${fileHash}_page_${pageNum}`,
                content: fullContent,
                metadata: {
                    page_num: pageNum,
                    source: filename,
                    document_type: 'pdf',
                    image_count: images.length,
                    images: images.length > 0 ? images : undefined,
                    tables: tables.length > 0 ? tables : undefined,
                    char_count: fullContent.length,
                    word_count: fullContent.split(/\s+/).filter(Boolean).length,
                },
            });
        }
    });

    return documents;
};

/**
 * Generate fixed-size chunk embeddings with overlap
 * Images are attached as metadata to the two adjacent chunks (before and after the image position).
 * 
 * @param {Object} documentState - The document state with pages
 * @param {string} fileHash - Unique hash for the file
 * @param {string} filename - The filename
 * @param {number} chunkSize - Size of each chunk (default: 500)
 * @param {number} overlap - Overlap between chunks (default: 100)
 * @returns {Array} - Array of document objects for embedding
 */
const generateChunkedEmbeddings = (documentState, fileHash, filename, chunkSize = 500, overlap = 100) => {
    // Step 1: Build combined content with position tracking for images and pages
    const contentParts = [];
    const imagePositions = []; // { position, image }
    const pageRanges = []; // { pageNum, startPosition, endPosition }
    let currentPosition = 0;

    (documentState.pages || []).forEach((page, pageIdx) => {
        const pageNum = page.pageNumber || pageIdx + 1;
        const pageStartPosition = currentPosition;
        const activeItems = (page.items || []).filter(item => !item.deleted);

        activeItems.forEach(item => {
            if (item.type === 'text') {
                // Add text content
                const text = item.content || '';
                if (text.trim()) {
                    if (contentParts.length > 0) {
                        contentParts.push('\n\n');
                        currentPosition += 2;
                    }
                    contentParts.push(text);
                    currentPosition += text.length;
                }
            } else if (item.type === 'image' || item.type === 'picture') {
                // Track image position (where it appears in the text flow)
                imagePositions.push({
                    position: currentPosition,
                    image: {
                        uuid: item.id,
                        imageUrl: item.imageUrl,
                        imageWidth: item.imageWidth,
                        imageHeight: item.imageHeight,
                        classification: item.classification || 'unknown',
                        description: item.description,
                        pageNumber: pageNum,
                    },
                });
            }
        });

        // Track page range (only if page has content)
        if (currentPosition > pageStartPosition) {
            pageRanges.push({
                pageNum,
                startPosition: pageStartPosition,
                endPosition: currentPosition,
            });
        }
    });

    const allContent = contentParts.join('');

    if (!allContent.trim()) {
        return [];
    }

    // Step 2: Create chunks with position tracking
    const chunks = [];
    let position = 0;
    let chunkIndex = 1;

    while (position < allContent.length) {
        const end = Math.min(position + chunkSize, allContent.length);
        const chunk = allContent.slice(position, end);

        // Find which pages this chunk spans
        const chunkPages = pageRanges
            .filter(pr => pr.startPosition < end && pr.endPosition > position)
            .map(pr => pr.pageNum);

        chunks.push({
            index: chunkIndex,
            content: chunk,
            startPosition: position,
            endPosition: end,
            pages: chunkPages,
            nearbyImages: [], // Will be populated in step 3
        });

        position = end - overlap;
        if (position >= allContent.length - overlap) break;
        chunkIndex++;
    }

    // Step 3: Attach images to adjacent chunks (before and after)
    imagePositions.forEach(({ position: imgPos, image }) => {
        // Find the chunk that contains or is just before the image position
        let chunkBeforeIdx = -1;
        let chunkAfterIdx = -1;

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];

            // Chunk contains the image position
            if (imgPos >= chunk.startPosition && imgPos < chunk.endPosition) {
                chunkBeforeIdx = i;
                chunkAfterIdx = i < chunks.length - 1 ? i + 1 : i;
                break;
            }

            // Image is between this chunk and the next
            if (imgPos >= chunk.endPosition && (i === chunks.length - 1 || imgPos < chunks[i + 1].startPosition)) {
                chunkBeforeIdx = i;
                chunkAfterIdx = i < chunks.length - 1 ? i + 1 : i;
                break;
            }
        }

        // Attach image to the chunk before (or containing)
        if (chunkBeforeIdx >= 0 && !chunks[chunkBeforeIdx].nearbyImages.some(img => img.uuid === image.uuid)) {
            chunks[chunkBeforeIdx].nearbyImages.push(image);
        }

        // Attach image to the chunk after (if different from before)
        if (chunkAfterIdx >= 0 && chunkAfterIdx !== chunkBeforeIdx &&
            !chunks[chunkAfterIdx].nearbyImages.some(img => img.uuid === image.uuid)) {
            chunks[chunkAfterIdx].nearbyImages.push(image);
        }
    });

    // Step 4: Convert to final document format
    const documents = chunks.map(chunk => ({
        id: `${fileHash}_chunk_${chunk.index}`,
        content: chunk.content,
        metadata: {
            chunk_index: chunk.index,
            source: filename,
            document_type: 'pdf',
            char_count: chunk.content.length,
            word_count: chunk.content.split(/\s+/).filter(Boolean).length,
            start_position: chunk.startPosition,
            end_position: chunk.endPosition,
            // Page numbers this chunk spans (e.g., [1, 2] if chunk crosses page boundary)
            page_numbers: chunk.pages.length > 0 ? chunk.pages : undefined,
            image_count: chunk.nearbyImages.length,
            images: chunk.nearbyImages.length > 0 ? chunk.nearbyImages : undefined,
        },
    }));

    return documents;
};

/**
 * Generate embedding preview locally (for local strategies)
 * This is the frontend implementation of preview generation.
 * 
 * @param {string} strategy - The embedding strategy
 * @param {Object} documentState - The document state with pages
 * @returns {Object} - Preview of embeddings
 */
export const generateLocalPreview = (strategy, documentState) => {
    const filename = documentState.filename || 'unknown';
    // Create a unique prefix from filename to avoid ID collisions across files
    const fileHash = simpleHash(filename + Date.now().toString());

    let documents = [];

    if (strategy === 'embed_per_page') {
        documents = generatePageEmbeddings(documentState, fileHash, filename);
    } else if (strategy === 'chunked_fixed') {
        documents = generateChunkedEmbeddings(documentState, fileHash, filename);
    }

    return {
        source: documentState.filename || 'unknown',
        document_type: 'pdf',
        page_count: documentState.totalPages || documentState.pages?.length || 0,
        total_embeddings: documents.length,
        strategy: strategy,
        documents,
    };
};

/**
 * Check if a strategy is local (handled in frontend)
 * @param {string} strategyId - The strategy ID
 * @returns {boolean}
 */
export const isLocalStrategy = (strategyId) => {
    return LOCAL_STRATEGIES.includes(strategyId);
};


