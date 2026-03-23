function sanitizeText(value) {
    if (value === null || value === undefined) {
        return '';
    }
    return String(value).trim();
}

function formatNumber(value) {
    const numericValue = Number(value);
    if (Number.isNaN(numericValue)) {
        return null;
    }
    return numericValue.toFixed(4);
}

function getSource(metadata = {}) {
    return metadata.source || metadata.filename || 'Unknown source';
}

function getPage(metadata = {}) {
    return metadata.page_number ?? metadata.page_range ?? 'N/A';
}

function getChunkIndex(metadata = {}) {
    return metadata.chunk_index ?? 'N/A';
}

export function generateLlmPrompt({ query, results, options = {} }) {
    const includeMetadata = options.includeMetadata !== false;
    const includeScores = options.includeScores === true;
    const hasMaxDocuments = Number.isInteger(options.maxDocuments) && options.maxDocuments > 0;
    const limitedResults = hasMaxDocuments ? results.slice(0, options.maxDocuments) : results;

    const sections = [
        '# Context-Based Question Answering',
        '',
        'You are given a question and a set of retrieved documents from a knowledge base. Answer the question based **only** on the provided context. If the context does not contain enough information to answer, say so.',
        '',
        '---',
        '',
        '## Question',
        '',
        sanitizeText(query) || '[No query provided]',
        '',
        '---',
        '',
        '## Retrieved Documents',
        '',
    ];

    if (limitedResults.length === 0) {
        sections.push('No documents were retrieved.');
        sections.push('');
    } else {
        limitedResults.forEach((result, index) => {
            const metadata = result?.metadata || {};
            const distance = formatNumber(result?.distance);
            const rerankScore = formatNumber(result?.rerankScore ?? metadata?.rerank_score);

            sections.push(`### Document ${index + 1}`);

            if (includeMetadata) {
                sections.push(`- **Source:** ${sanitizeText(getSource(metadata)) || 'Unknown source'}`);
                sections.push(`- **Page:** ${sanitizeText(getPage(metadata)) || 'N/A'}`);
                sections.push(`- **Chunk:** ${sanitizeText(getChunkIndex(metadata)) || 'N/A'}`);
            }

            if (includeScores) {
                sections.push(`- **Distance:** ${distance ?? 'N/A'}`);
                sections.push(`- **Rerank Score:** ${rerankScore ?? 'N/A'}`);
            }

            sections.push('');
            sections.push(sanitizeText(result?.content) || '[No content]');
            sections.push('');
        });
    }

    sections.push('---');
    sections.push('');
    sections.push('## Instructions');
    sections.push('');
    sections.push('Based on the documents above, provide a comprehensive answer to the question. Cite the document numbers (e.g., [Document 1]) when referencing specific information.');

    return sections.join('\n');
}
