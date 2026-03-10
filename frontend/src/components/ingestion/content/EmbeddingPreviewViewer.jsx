/**
 * EmbeddingPreviewViewer Component
 * 
 * Displays embedding previews in a paginated view within the main content area.
 * Shows text content, images (base64), tables, and metadata for each embedding.
 * Replaces ContentViewer when in preview mode.
 * 
 * Supports:
 * - Single file preview with "Confirm & Ingest"
 * - Multi-file preview with "Confirm & Ingest" and "Ingest All" buttons
 */

import { useState, useCallback, useEffect } from 'react';
import PageNavigation from './PageNavigation';

// LLM service base URL for static images
const LLM_BASE_URL = import.meta.env.VITE_IMAGE_BASE_URL || 'http://localhost:8000';

/**
 * Resolve image URL - handle data URLs, full URLs, and static paths
 * @param {string} url - The image URL from the backend
 * @returns {string} - Resolved URL
 */
function resolveImageUrl(url) {
    if (!url) return '';
    // Data URLs and full URLs - use as-is
    if (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://')) {
        return url;
    }
    // Static paths from LLM service - prefix with base URL
    if (url.startsWith('/static/')) {
        return `${LLM_BASE_URL}${url}`;
    }
    // Other relative paths - also prefix with base URL
    return `${LLM_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

/**
 * Single Embedding Display
 */
function EmbeddingCard({ embedding, embeddingNumber, isDarkMode = false }) {
    const { id, content, metadata } = embedding;
    const images = metadata?.images || [];
    const tables = metadata?.tables || [];

    return (
        <div className={`rounded-xl border overflow-hidden shadow-sm ${isDarkMode ? 'bg-[#2d2d2d] border-[#404040]' : 'bg-white border-brand-grey-7'}`}>
            {/* Header */}
            <div className="bg-gradient-to-r from-brand-blue to-brand-dark-blue px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-white text-brand-blue text-sm font-bold">
                        {embeddingNumber}
                    </span>
                    <div>
                        <h3 className="text-white font-semibold">{id}</h3>
                        <p className="text-brand-blue-light-4 text-xs">
                            {metadata?.char_count || content?.length || 0} chars
                            {metadata?.word_count && ` • ${metadata.word_count} words`}
                            {images.length > 0 && ` • ${images.length} image(s)`}
                            {tables.length > 0 && ` • ${tables.length} table(s)`}
                        </p>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="p-4">
                {/* Text Content */}
                {content && (
                    <div className="mb-4">
                        <h4 className={`text-xs font-semibold uppercase tracking-wide mb-2 flex items-center gap-2 ${isDarkMode ? 'text-[#b0b0b0]' : 'text-brand-grey-3'}`}>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Text to be Embedded
                        </h4>
                        <div className={`rounded-lg p-4 text-sm font-mono whitespace-pre-wrap max-h-64 overflow-y-auto ${isDarkMode ? 'bg-[#404040] text-white' : 'bg-brand-grey-9 text-brand-black'}`}>
                            {content}
                        </div>
                    </div>
                )}

                {/* Images */}
                {images.length > 0 && (
                    <div className="mb-4">
                        <h4 className={`text-xs font-semibold uppercase tracking-wide mb-2 flex items-center gap-2 ${isDarkMode ? 'text-[#b0b0b0]' : 'text-brand-grey-3'}`}>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Images ({images.length})
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {images.map((img, idx) => (
                                <div key={img.uuid || idx} className={`border rounded-lg overflow-hidden ${isDarkMode ? 'border-[#404040] bg-[#404040]' : 'border-brand-grey-7 bg-brand-grey-9'}`}>
                                    {img.imageUrl && (
                                        <div className={`flex items-center justify-center p-2 ${isDarkMode ? 'bg-[#2d2d2d]' : 'bg-white'}`}>
                                            <img
                                                src={resolveImageUrl(img.imageUrl)}
                                                alt={img.description || `Image ${idx + 1}`}
                                                className="max-h-40 object-contain"
                                                style={{
                                                    maxWidth: img.imageWidth ? Math.min(img.imageWidth, 300) : '100%'
                                                }}
                                            />
                                        </div>
                                    )}
                                    <div className={`px-3 py-2 border-t ${isDarkMode ? 'bg-[#404040] border-[#555]' : 'bg-brand-grey-9 border-brand-grey-7'}`}>
                                        <div className="flex items-center justify-between text-xs">
                                            <span className={isDarkMode ? 'text-[#b0b0b0]' : 'text-brand-grey-4'}>Classification:</span>
                                            <span className="font-medium text-brand-blue px-2 py-0.5 bg-brand-blue-light-5 rounded">
                                                {img.classification || 'unknown'}
                                            </span>
                                        </div>
                                        {img.description && (
                                            <p className={`text-xs mt-1 italic ${isDarkMode ? 'text-[#b0b0b0]' : 'text-brand-grey-3'}`}>{img.description}</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Tables */}
                {tables.length > 0 && (
                    <div className="mb-4">
                        <h4 className={`text-xs font-semibold uppercase tracking-wide mb-2 flex items-center gap-2 ${isDarkMode ? 'text-[#b0b0b0]' : 'text-brand-grey-3'}`}>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7-8v8m14-8v8M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                            Tables ({tables.length})
                        </h4>
                        {tables.map((table, idx) => (
                            <div key={table.id || idx} className={`border rounded-lg overflow-hidden mb-2 ${isDarkMode ? 'border-[#404040]' : 'border-brand-grey-7'}`}>
                                {table.tableData && (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            {table.tableData.headers && (
                                                <thead className={isDarkMode ? 'bg-brand-blue/20' : 'bg-brand-blue-light-5'}>
                                                    <tr>
                                                        {table.tableData.headers.map((header, hIdx) => (
                                                            <th key={hIdx} className={`px-3 py-2 text-left font-semibold border-b ${isDarkMode ? 'text-brand-blue-light border-[#404040]' : 'text-brand-blue border-brand-grey-7'}`}>
                                                                {header}
                                                            </th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                            )}
                                            <tbody>
                                                {table.tableData.rows?.map((row, rIdx) => (
                                                    <tr key={rIdx} className={rIdx % 2 === 0 ? (isDarkMode ? 'bg-[#2d2d2d]' : 'bg-white') : (isDarkMode ? 'bg-[#404040]' : 'bg-brand-grey-9')}>
                                                        {row.map((cell, cIdx) => (
                                                            <td key={cIdx} className={`px-3 py-2 border-b ${isDarkMode ? 'text-white border-[#404040]' : 'text-brand-black border-brand-grey-8'}`}>
                                                                {cell}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Metadata */}
                <div>
                    <h4 className={`text-xs font-semibold uppercase tracking-wide mb-2 flex items-center gap-2 ${isDarkMode ? 'text-[#b0b0b0]' : 'text-brand-grey-3'}`}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                        Metadata
                    </h4>
                    <div className={`rounded-lg p-3 ${isDarkMode ? 'bg-brand-blue/10' : 'bg-brand-blue-light-5'}`}>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                            {Object.entries(metadata || {}).map(([key, value]) => {
                                if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                                    return null;
                                }
                                if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
                                    return null;
                                }
                                if (value === undefined || value === null || value === '') {
                                    return null;
                                }
                                const displayValue = Array.isArray(value) ? value.join(', ') : String(value);
                                return (
                                    <div key={key} className="flex flex-col">
                                        <span className={`text-xs ${isDarkMode ? 'text-[#888]' : 'text-brand-grey-4'}`}>{key}</span>
                                        <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-brand-black'}`}>{displayValue}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * Items per page selector
 */
function ItemsPerPageSelector({ value, onChange, hasVisualContent, isDarkMode = false }) {
    const options = hasVisualContent
        ? [1, 2, 3, 5]
        : [1, 3, 5, 10, 20];

    return (
        <div className="flex items-center gap-2 text-sm">
            <label className={isDarkMode ? 'text-[#b0b0b0]' : 'text-brand-grey-4'}>Show:</label>
            <select
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className={`px-2 py-1 border rounded focus:outline-none focus:ring-1 focus:ring-brand-blue cursor-pointer
                    ${isDarkMode 
                        ? 'bg-[#404040] border-[#555] text-white' 
                        : 'bg-white border-brand-grey-7 text-brand-black'
                    }`}
            >
                {options.map(opt => (
                    <option key={opt} value={opt}>{opt} per page</option>
                ))}
            </select>
        </div>
    );
}

/**
 * Main EmbeddingPreviewViewer component
 */
export default function EmbeddingPreviewViewer({
    preview,
    isLoading,
    isIngesting = false,
    onCancel,
    onConfirm,
    onConfirmAll,
    readOnly = false,
    isMultiFile = false,
    totalFilesInPreview = 1,
    isDarkMode = false,
}) {
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(3);

    const documents = preview?.documents || [];
    const totalItems = documents.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    // Check if any document has images or tables (visual content)
    const hasVisualContent = documents.some(doc =>
        (doc.metadata?.images?.length > 0) || (doc.metadata?.tables?.length > 0)
    );

    // Auto-adjust items per page if visual content is detected
    useEffect(() => {
        if (hasVisualContent && itemsPerPage > 3) {
            setItemsPerPage(1);
        }
    }, [hasVisualContent, itemsPerPage]);

    // Reset to page 1 when items per page changes
    useEffect(() => {
        setCurrentPage(1);
    }, [itemsPerPage]);

    // Get current page items
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
    const currentItems = documents.slice(startIndex, endIndex);

    const handlePageChange = useCallback((page) => {
        setCurrentPage(page);
    }, []);

    if (isLoading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-brand-blue border-t-transparent mb-4"></div>
                <p className={`text-sm ${isDarkMode ? 'text-[#b0b0b0]' : 'text-brand-grey-4'}`}>Generating embedding preview...</p>
            </div>
        );
    }

    if (!preview || !documents.length) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
                <div className="text-6xl mb-4">📭</div>
                <p className={`text-lg ${isDarkMode ? 'text-[#b0b0b0]' : 'text-brand-grey-4'}`}>No embeddings to preview</p>
                <p className={`text-sm mt-1 ${isDarkMode ? 'text-[#888]' : 'text-brand-grey-5'}`}>The document may be empty or all content was deleted</p>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Top Action Bar */}
            <div className={`border-b px-6 py-3 flex items-center justify-between shrink-0 ${isDarkMode ? 'bg-[#2d2d2d] border-[#404040]' : 'bg-gradient-to-r from-brand-blue-light-5 to-brand-blue-light-4 border-brand-grey-7'}`}>
                <div className="flex items-center gap-3">
                    {!readOnly ? (
                        <>
                            <button
                                onClick={onCancel}
                                disabled={isIngesting}
                                className={`px-4 py-2 text-sm font-semibold border rounded-lg transition-colors flex items-center gap-2
                                    ${isDarkMode 
                                        ? 'text-white bg-[#404040] border-[#555] hover:bg-[#4a4a4a]' 
                                        : 'text-brand-black bg-white border-brand-grey-7 hover:bg-brand-grey-9'
                                    }
                                    ${isIngesting ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                Cancel
                            </button>
                            <button
                                onClick={onConfirm}
                                disabled={isIngesting}
                                className={`px-4 py-2 text-sm font-semibold text-white bg-brand-blue 
                                    rounded-lg transition-colors flex items-center gap-2
                                    shadow-md shadow-brand-blue/20
                                    ${isIngesting ? 'opacity-70 cursor-not-allowed' : 'hover:bg-brand-dark-blue'}`}
                            >
                                {isIngesting ? (
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                )}
                                {isIngesting ? 'Ingesting...' : 'Confirm & Ingest'}
                            </button>

                            {isMultiFile && totalFilesInPreview > 1 && (
                                <button
                                    onClick={onConfirmAll}
                                    disabled={isIngesting}
                                    className={`px-4 py-2 text-sm font-semibold text-white bg-brand-green 
                                        rounded-lg transition-colors flex items-center gap-2
                                        shadow-md shadow-brand-green/20
                                        ${isIngesting ? 'opacity-70 cursor-not-allowed' : 'hover:bg-brand-green/90'}`}
                                >
                                    {isIngesting ? (
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    )}
                                    {isIngesting ? 'Ingesting...' : `Ingest All (${totalFilesInPreview})`}
                                </button>
                            )}
                        </>
                    ) : (
                        <div className="flex items-center gap-2 text-brand-green">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-sm font-semibold">Ingested Document</span>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-4">
                    <ItemsPerPageSelector
                        value={itemsPerPage}
                        onChange={setItemsPerPage}
                        hasVisualContent={hasVisualContent}
                        isDarkMode={isDarkMode}
                    />
                    <div className="text-sm">
                        <span className="font-bold text-brand-blue">{totalItems}</span>
                        <span className={isDarkMode ? 'text-[#b0b0b0]' : 'text-brand-grey-4'}> total embedding{totalItems !== 1 ? 's' : ''}</span>
                    </div>
                </div>
            </div>

            {/* Summary Bar */}
            <div className={`border-b px-6 py-2 flex items-center justify-between text-sm shrink-0 ${isDarkMode ? 'bg-[#2d2d2d] border-[#404040]' : 'bg-white border-brand-grey-7'}`}>
                <div className={`flex items-center gap-4 ${isDarkMode ? 'text-[#b0b0b0]' : 'text-brand-grey-4'}`}>
                    <span><strong className={isDarkMode ? 'text-white' : 'text-brand-black'}>{preview.source}</strong></span>
                    <span>•</span>
                    <span>{preview.page_count} page{preview.page_count !== 1 ? 's' : ''}</span>
                    <span>•</span>
                    <span className="px-2 py-0.5 bg-brand-blue-light-5 text-brand-blue rounded font-medium">
                        {preview.strategy === 'embed_per_page' ? 'Page-Based' :
                            preview.strategy === 'chunked_document' ? 'Semantic Chunking' : preview.strategy}
                    </span>
                </div>
                <div className={isDarkMode ? 'text-[#b0b0b0]' : 'text-brand-grey-4'}>
                    Showing {startIndex + 1}-{endIndex} of {totalItems}
                </div>
            </div>

            {/* Scrollable Content Area */}
            <div className={`flex-1 overflow-y-auto p-6 ${isDarkMode ? 'bg-[#212121]' : ''}`}>
                <div className="max-w-4xl mx-auto flex flex-col gap-6">
                    {currentItems.map((embedding, idx) => (
                        <EmbeddingCard
                            key={embedding.id}
                            embedding={embedding}
                            embeddingNumber={startIndex + idx + 1}
                            isDarkMode={isDarkMode}
                        />
                    ))}
                </div>
            </div>

            {/* Page Navigation */}
            {totalPages > 1 && (
                <PageNavigation
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={handlePageChange}
                    isDarkMode={isDarkMode}
                />
            )}
        </div>
    );
}
