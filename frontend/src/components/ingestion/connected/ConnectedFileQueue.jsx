/**
 * ConnectedFileQueue Component
 * 
 * File queue that connects directly to ingestion context.
 * Owns its own state subscriptions and dispatches actions directly.
 * 
 * @see doc/ingestion/COMPONENT_RESPONSIBILITIES.md
 */

import { useCallback, useState } from 'react';
import { toast } from 'react-toastify';
import {
    useFileQueue,
    usePreview,
    useUI,
    useIngestionActions,
} from '../../../context/ingestion';
import { removeUploadedFile, removeIngestedFile, getFileContent } from '../../../utils/fileCacheManager';
import { previewEmbeddings } from '../../../services/ingestionApi';
import FileQueueItem from '../content/FileQueueItem';

export default function ConnectedFileQueue({ isDarkMode }) {
    // Subscribe to relevant state
    const { uploadQueue, ingestedFiles, selectedDocumentId } = useFileQueue();
    const { isPreviewMode, previewDocumentIds, previewConfig, isLoadingPreview } = usePreview();
    const { multiSelectMode, checkedDocumentIds } = useUI();
    const actions = useIngestionActions();

    // Local state for tracking which file is being loaded
    const [switchingToDocId, setSwitchingToDocId] = useState(null);

    // In preview mode, filter to only show files being previewed
    const displayFiles = isPreviewMode
        ? uploadQueue.filter(f => previewDocumentIds.has(f.documentId))
        : uploadQueue;

    // Handle file selection - in preview mode, also switch the preview
    const handleSelect = useCallback(async (documentId) => {
        // If in preview mode and selecting a different file, generate new preview
        if (isPreviewMode && documentId !== selectedDocumentId) {
            if (isLoadingPreview || switchingToDocId) return; // Already loading

            setSwitchingToDocId(documentId);

            try {
                // Get the document content from cache
                const content = getFileContent(documentId);
                if (!content) {
                    toast.error('Could not load file content');
                    return;
                }

                // Generate preview for this file
                const result = await previewEmbeddings(previewConfig.strategy, content);

                if (result.success) {
                    // Switch to this file's preview
                    actions.switchPreviewFile(documentId, result.preview);
                } else {
                    throw new Error(result.error || 'Failed to generate preview');
                }
            } catch (error) {
                console.error('Failed to switch preview:', error);
                toast.error(`Failed to load preview: ${error.message}`);
            } finally {
                setSwitchingToDocId(null);
            }
        } else {
            // Normal selection (not in preview mode)
            actions.selectFile(documentId);
        }
    }, [isPreviewMode, selectedDocumentId, isLoadingPreview, switchingToDocId, previewConfig?.strategy, actions]);

    // Handle check in multi-select mode
    const handleCheck = useCallback((documentId) => {
        actions.checkDocument(documentId);
    }, [actions]);

    // Handle remove from preview
    const handleRemoveFromPreview = useCallback((documentId) => {
        actions.removePreviewFile(documentId);
        if (previewDocumentIds.size <= 1) {
            toast.info('Preview cancelled - no files remaining');
        }
    }, [actions, previewDocumentIds.size]);

    // Handle remove uploaded file
    // This also removes any ingested versions of this file
    const handleRemoveUploadedFile = useCallback((documentId) => {
        // removeUploadedFile returns the removed ingested IDs and cleans up all related caches
        const removedIngestedIds = removeUploadedFile(documentId);

        // Remove from context state
        actions.removeFile(documentId);

        // Also remove any related ingested files from context state
        removedIngestedIds.forEach(ingestedId => {
            actions.removeIngestedFile(ingestedId);
        });

        toast.info('File removed');
    }, [actions]);

    // Handle remove ingested file
    // Only removes the ingested file - uploaded file is preserved for potential re-ingestion
    const handleRemoveIngestedFile = useCallback((ingestedId) => {
        removeIngestedFile(ingestedId);
        actions.removeIngestedFile(ingestedId);
        toast.info('Ingested file removed');
    }, [actions]);

    // Determine remove handler for uploaded files section
    // Note: Ingested files section uses handleRemoveIngestedFile directly
    const getRemoveHandler = useCallback((documentId) => {
        if (isPreviewMode) {
            return () => handleRemoveFromPreview(documentId);
        }
        // In the uploaded files section, always use handleRemoveUploadedFile
        return () => handleRemoveUploadedFile(documentId);
    }, [isPreviewMode, handleRemoveFromPreview, handleRemoveUploadedFile]);

    return (
        <div className="flex-1 overflow-y-auto flex flex-col">
            {/* Files Section (Uploaded/Content) */}
            <div className="flex-1">
                <h3 className={`text-sm font-bold mb-2 uppercase tracking-wide ${isDarkMode ? 'text-white' : 'text-brand-black'}`}>
                    {isPreviewMode ? 'Preview Files' : 'Files'} ({displayFiles.length})
                    {multiSelectMode && checkedDocumentIds.size > 0 && (
                        <span className="ml-2 text-brand-blue">
                            • {checkedDocumentIds.size} selected
                        </span>
                    )}
                </h3>

                {displayFiles.length === 0 ? (
                    <p className={`text-sm italic ${isDarkMode ? 'text-white/60' : 'text-brand-black/60'}`}>
                        {isPreviewMode ? 'No files in preview' : 'No files uploaded yet'}
                    </p>
                ) : (
                    <ul className="space-y-2">
                        {displayFiles.map((doc) => (
                            <FileQueueItem
                                key={doc.id}
                                doc={doc}
                                isSelected={doc.documentId === selectedDocumentId}
                                isChecked={checkedDocumentIds.has(doc.documentId)}
                                isLoading={switchingToDocId === doc.documentId}
                                onSelect={() => handleSelect(doc.documentId)}
                                onCheck={() => handleCheck(doc.documentId)}
                                showCheckbox={multiSelectMode && !isPreviewMode}
                                removableMode={true}
                                onRemoveFromSelection={getRemoveHandler(doc.documentId)}
                                isDarkMode={isDarkMode}
                            />
                        ))}
                    </ul>
                )}
            </div>

            {/* Ingested Files Section */}
            {!isPreviewMode && ingestedFiles.length > 0 && (
                <div className={`mt-4 pt-4 border-t ${isDarkMode ? 'border-[#404040]' : 'border-brand-grey-7'}`}>
                    <h3 className={`text-sm font-bold mb-2 uppercase tracking-wide flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-brand-black'}`}>
                        <span className="text-base">🧠</span>
                        Ingested ({ingestedFiles.length})
                    </h3>
                    <ul className="space-y-2">
                        {ingestedFiles.map((doc) => (
                            <FileQueueItem
                                key={doc.id}
                                doc={doc.toFileQueueItemProps()}
                                isSelected={doc.id === selectedDocumentId}
                                isChecked={false}
                                onSelect={() => handleSelect(doc.id)}
                                showCheckbox={false}
                                removableMode={true}
                                onRemoveFromSelection={() => handleRemoveIngestedFile(doc.id)}
                                isDarkMode={isDarkMode}
                            />
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
