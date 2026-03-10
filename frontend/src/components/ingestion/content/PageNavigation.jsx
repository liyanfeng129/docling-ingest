/**
 * PageNavigation Component
 * 
 * Page navigation controls with previous/next buttons.
 * Supports clickable page indicator to jump to specific pages.
 */

import { useState, useEffect, useCallback } from 'react';

/**
 * @param {Object} props
 * @param {number} props.currentPage - Current page number (1-indexed)
 * @param {number} props.totalPages - Total number of pages
 * @param {Function} props.onPageChange - Page change handler
 * @param {boolean} props.enableKeyboard - Enable keyboard navigation (default: true)
 */
export default function PageNavigation({
    currentPage,
    totalPages,
    onPageChange,
    enableKeyboard = true,
}) {
    const [isEditingPage, setIsEditingPage] = useState(false);
    const [pageInputValue, setPageInputValue] = useState('');

    // Go to a specific page (clamped to valid range)
    const goToPage = useCallback((page) => {
        const newPage = Math.max(1, Math.min(page, totalPages));
        if (newPage !== currentPage) {
            onPageChange(newPage);
        }
    }, [currentPage, totalPages, onPageChange]);

    // Handle page input submission
    const handlePageInputSubmit = useCallback(() => {
        const pageNum = parseInt(pageInputValue, 10);
        if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
            goToPage(pageNum);
        }
        setIsEditingPage(false);
        setPageInputValue('');
    }, [pageInputValue, totalPages, goToPage]);

    // Keyboard navigation
    useEffect(() => {
        if (!enableKeyboard) return;

        const handleKeyDown = (e) => {
            // Don't handle if user is typing in an input/textarea
            if (e.target.matches('input, textarea, [contenteditable]')) return;

            if (e.key === 'ArrowLeft') {
                goToPage(currentPage - 1);
            } else if (e.key === 'ArrowRight') {
                goToPage(currentPage + 1);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [enableKeyboard, currentPage, goToPage]);

    if (totalPages <= 1) return null;

    return (
        <div className="bg-white border-t border-brand-grey-7 px-6 py-3 flex items-center justify-center space-x-4">
            <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-4 py-2 transition-all disabled:opacity-40
                    bg-white border border-brand-blue hover:bg-brand-blue-light-5 text-brand-blue font-bold"
                aria-label="Previous page"
            >
                ← Previous
            </button>

            {isEditingPage ? (
                <div className="flex items-center gap-1">
                    <span className="text-sm font-bold text-brand-black">Page</span>
                    <input
                        type="number"
                        min={1}
                        max={totalPages}
                        value={pageInputValue}
                        onChange={(e) => setPageInputValue(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                handlePageInputSubmit();
                            } else if (e.key === 'Escape') {
                                setIsEditingPage(false);
                                setPageInputValue('');
                            }
                        }}
                        onBlur={handlePageInputSubmit}
                        autoFocus
                        className="w-16 px-2 py-1 text-sm font-bold text-brand-black text-center 
                            border border-brand-blue rounded focus:outline-none focus:ring-1 focus:ring-brand-blue"
                        placeholder={String(currentPage)}
                    />
                    <span className="text-sm font-medium text-brand-grey-4">of {totalPages}</span>
                </div>
            ) : (
                <button
                    onClick={() => {
                        setPageInputValue(String(currentPage));
                        setIsEditingPage(true);
                    }}
                    className="px-4 py-1.5 rounded-full text-sm font-medium text-brand-grey-4 bg-white border border-brand-grey-7 hover:border-brand-blue hover:text-brand-blue transition-all shadow-sm"
                    title="Click to jump to a specific page"
                >
                    Page {currentPage} of {totalPages}
                </button>
            )}

            <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-4 py-2 transition-all disabled:opacity-40
                    bg-white border border-brand-blue hover:bg-brand-blue-light-5 text-brand-blue font-bold"
                aria-label="Next page"
            >
                Next →
            </button>
        </div>
    );
}
