/**
 * ConnectedContentViewer Component
 * 
 * Content viewer that connects directly to ingestion context.
 * Handles document display, page navigation, and item editing.
 * 
 * @see doc/ingestion/COMPONENT_RESPONSIBILITIES.md
 */

import { useCallback } from 'react';
import { toast } from 'react-toastify';
import {
    useDocument,
    useIngestionActions,
} from '../../../context/ingestion';
import useBackendConfig from '../../../hooks/useBackendConfig';
import { Commands } from '../../../hooks/useCommandHistory';
import PageContent from '../content/PageContent';
import PageNavigation from '../content/PageNavigation';

export default function ConnectedContentViewer({
    // Command history is passed in because it's shared with header for undo/redo
    commandState,
    executeCommand,
    isDarkMode = false,
}) {
    const { currentPage } = useDocument();
    const actions = useIngestionActions();
    const { config: backendConfig } = useBackendConfig();

    // Use passed command state directly (source of truth for editing)
    const doc = commandState;
    // Use availableImageClasses or imageClasses from backend config with fallback
    const availableClasses = backendConfig?.availableImageClasses
        || backendConfig?.imageClasses
        || ['logo', 'figure', 'chart', 'diagram', 'photo', 'screenshot', 'table_image', 'other'];
    const totalPages = doc?.pages?.length || 0;
    const currentPageContent = doc?.pages?.[currentPage - 1];

    // Page navigation
    const handlePageChange = useCallback((page) => {
        if (!doc?.pages) return;
        const maxPage = doc.pages.length;
        const newPage = Math.max(1, Math.min(page, maxPage));
        actions.changePage(newPage);
    }, [doc, actions]);

    // Edit item
    const handleEditItem = useCallback((itemId, newContent) => {
        if (!doc) return;
        let oldContent = '';
        for (const page of doc.pages) {
            const item = page.items.find(i => i.id === itemId);
            if (item) {
                oldContent = item.content;
                break;
            }
        }
        executeCommand(Commands.editItem(itemId, newContent, oldContent));
    }, [doc, executeCommand]);

    // Delete item
    const handleDeleteItem = useCallback((itemId) => {
        if (!doc) return;
        executeCommand(Commands.deleteItem(itemId));
        toast.info('Item deleted (can be undone)');
    }, [doc, executeCommand]);

    // Change item classification
    const handleClassChange = useCallback((itemId, newClass) => {
        if (!doc) return;
        let oldClass = '';
        for (const page of doc.pages) {
            const item = page.items.find(i => i.id === itemId);
            if (item) {
                oldClass = item.classification || '';
                break;
            }
        }
        executeCommand(Commands.changeClass(itemId, newClass, oldClass));
    }, [doc, executeCommand]);

    // Empty state
    if (!doc) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className={`text-center ${isDarkMode ? 'text-[#b0b0b0]' : 'text-brand-grey-4'}`}>
                    <div className="text-6xl mb-4">📄</div>
                    <p className="text-lg">Upload a document to get started</p>
                    <p className="text-sm mt-2">
                        Drag and drop files or use the upload zone on the left
                    </p>
                </div>
            </div>
        );
    }

    // Empty document
    if (totalPages === 0) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className={`text-center ${isDarkMode ? 'text-[#b0b0b0]' : 'text-brand-grey-4'}`}>
                    <div className="text-6xl mb-4">📭</div>
                    <p className="text-lg">No content extracted</p>
                    <p className="text-sm mt-2">
                        This document appears to be empty. Try a different file.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-4xl mx-auto">
                    <PageContent
                        page={currentPageContent}
                        onEditItem={handleEditItem}
                        onDeleteItem={handleDeleteItem}
                        onClassChange={handleClassChange}
                        availableClasses={availableClasses}
                        isDarkMode={isDarkMode}
                    />
                </div>
            </div>

            <PageNavigation
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
                isDarkMode={isDarkMode}
            />
        </div>
    );
}
