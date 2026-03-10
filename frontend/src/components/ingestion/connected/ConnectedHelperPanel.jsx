/**
 * ConnectedHelperPanel Component
 * 
 * Helper panel that connects directly to ingestion context.
 * Handles helper execution logic internally.
 * Uses backendConfig for dynamic helper list from backend.
 * 
 * @see doc/ingestion/COMPONENT_RESPONSIBILITIES.md
 */

import { useCallback, useMemo } from 'react';
import { toast } from 'react-toastify';
import {
    useUI,
    useFileQueue,
    useIngestionActions,
    MODAL_TYPES,
    DOC_STATUS,
} from '../../../context/ingestion';
import useBackendConfig from '../../../hooks/useBackendConfig';
import useLocalHelper, { findAllImages } from '../../../hooks/useLocalHelper';
import { streamImageDescriptions } from '../../../services/ingestionApi';
import { Commands } from '../../../hooks/useCommandHistory';
import { INGESTION_CONFIG } from '../../../config/ingestionConfig';

export default function ConnectedHelperPanel({ commandState, executeCommand, isDarkMode = false }) {
    const { runningHelper, isIngesting } = useUI();
    const { uploadQueue } = useFileQueue();
    const actions = useIngestionActions();
    const { config: backendConfig } = useBackendConfig();

    // Use commandState (from useCommandHistory) as the document state
    const documentState = commandState;

    // Use local helper hook for frontend-only helpers
    const localHelperHook = useLocalHelper();

    const disabled = !documentState || isIngesting;

    // Get helpers from backend config, split by type and filter enabled only
    // Fall back to static INGESTION_CONFIG if backend doesn't return helpers
    const localHelpers = useMemo(() => {
        const helpers = backendConfig?.helpers || [];
        const filtered = helpers.filter(h => h.type === 'local' && h.enabled !== false);
        // Fallback to static config if no helpers from backend
        if (filtered.length === 0) {
            return INGESTION_CONFIG.helpers.local || [];
        }
        return filtered;
    }, [backendConfig]);

    const backendHelpers = useMemo(() => {
        const helpers = backendConfig?.helpers || [];
        const filtered = helpers.filter(h => h.type === 'backend' && h.enabled !== false);
        // Fallback to static config if no backend helpers from API
        if (filtered.length === 0) {
            return INGESTION_CONFIG.helpers.backend || [];
        }
        return filtered;
    }, [backendConfig]);

    // Get all helpers as a flat array for lookup
    const allHelpers = useMemo(() => [...localHelpers, ...backendHelpers], [localHelpers, backendHelpers]);

    // Count ready files (files that helper can be applied to)
    const readyFiles = useMemo(
        () => uploadQueue.filter(f => f.status === DOC_STATUS.READY),
        [uploadQueue]
    );

    // Execute helper directly on current document
    // NOTE: Must be defined BEFORE handleHelperClick since it's called by that function
    const executeHelper = useCallback(async (helperId) => {
        console.log('[ExecuteHelper] Starting helper:', helperId);
        actions.startHelper(helperId);

        try {
            let message = '';

            switch (helperId) {
                case 'remove_logos':
                case 'remove_empty': {
                    // Use local helper hook for these helpers
                    const result = localHelperHook.execute(helperId, documentState);
                    if (result.itemIds.length > 0) {
                        executeCommand(Commands.batchDelete(result.itemIds));
                    }
                    message = result.message;
                    break;
                }

                case 'ai_image_descriptions': {
                    // Use findAllImages from useLocalHelper to collect images
                    // Debug: log document structure
                    console.log('[AI Image Helper] Document state:', {
                        documentId: documentState?.documentId,
                        filename: documentState?.filename,
                        pageCount: documentState?.pages?.length,
                    });

                    if (!documentState?.pages) {
                        console.error('[AI Image Helper] No pages in document state');
                        message = 'No document loaded or document has no pages.';
                        break;
                    }

                    // Use helper function from useLocalHelper hook
                    const allImages = findAllImages(documentState, false); // Include images without URLs for logging
                    console.log(`[AI Image Helper] Found ${allImages.length} images:`, allImages);

                    // Filter to only images with URLs
                    const imagesWithUrls = findAllImages(documentState, true);
                    if (imagesWithUrls.length < allImages.length) {
                        console.warn(`[AI Image Helper] ${allImages.length - imagesWithUrls.length} images have no imageUrl`);
                    }

                    if (imagesWithUrls.length === 0) {
                        message = 'No images with URLs found in document. Images may not have been processed correctly.';
                        break;
                    }

                    // Stream descriptions - each one updates UI immediately
                    let successCount = 0;
                    let totalCount = imagesWithUrls.length;

                    await streamImageDescriptions(
                        documentState.documentId,
                        imagesWithUrls,
                        {
                            onStart: (total, docId) => {
                                console.log(`[AI Image Helper] Started streaming ${total} images for ${docId}`);
                                toast.info(`Generating descriptions for ${total} image(s)...`);
                            },
                            onDescription: (imageId, classification, description) => {
                                console.log(`[AI Image Helper] Got description for ${imageId}`);
                                successCount++;

                                // Insert description immediately after the image
                                const insertion = {
                                    afterItemId: imageId,
                                    newItem: {
                                        id: `desc_${imageId}_${Date.now()}`,
                                        type: 'text',
                                        content: `**Image Description:** ${description}`,
                                        deleted: false,
                                    },
                                };
                                executeCommand(Commands.batchInsertAfter([insertion]));

                                // Show progress toast
                                toast.success(`✓ ${successCount}/${totalCount}: ${classification}`, { autoClose: 1500 });
                            },
                            onError: (error, imageId) => {
                                console.error(`[AI Image Helper] Error for ${imageId || 'stream'}:`, error);
                                if (imageId) {
                                    toast.warning(`Failed for image: ${error}`, { autoClose: 3000 });
                                }
                            },
                            onDone: (success, total) => {
                                console.log(`[AI Image Helper] Done: ${success}/${total} successful`);
                            },
                        }
                    );

                    message = `Generated descriptions for ${successCount}/${totalCount} image(s)`;
                    break;
                }

                default:
                    message = 'Unknown helper';
            }

            toast.success(message);
            actions.completeHelper();
        } catch (error) {
            console.error('Helper failed:', error);
            toast.error('Helper failed: ' + error.message);
            actions.failHelper();
        }
    }, [documentState, executeCommand, actions, localHelperHook]);

    // Handle helper button click
    const handleHelperClick = useCallback((helperId) => {
        console.log('[HelperPanel] Button clicked:', helperId);
        console.log('[HelperPanel] documentState:', documentState ? 'exists' : 'null');
        console.log('[HelperPanel] readyFiles.length:', readyFiles.length);

        if (!documentState) {
            toast.warning('No document loaded to apply helper');
            return;
        }

        // Handle regex helper separately (always shows its own modal)
        if (helperId === 'delete_regex') {
            actions.openModal(MODAL_TYPES.REGEX);
            return;
        }

        // If multiple ready files exist, show file selection modal
        if (readyFiles.length > 1) {
            console.log('[HelperPanel] Multiple files - showing file selection modal');
            const helper = allHelpers.find(h => h.id === helperId);
            actions.setPendingHelper(helper);
            actions.openHelperFileSelectModal();
            return;
        }

        // Only one file - execute directly
        console.log('[HelperPanel] Executing helper directly');
        executeHelper(helperId);
    }, [documentState, readyFiles.length, allHelpers, actions, executeHelper]);

    return (
        <div className="flex-1 p-4 overflow-y-auto">
            {/* Local Helpers */}
            <div className="space-y-2 mb-4">
                <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${isDarkMode ? 'text-brand-blue-light' : 'text-brand-blue'}`}>
                    Local
                </p>
                {localHelpers.map((helper) => (
                    <button
                        key={helper.id}
                        onClick={() => handleHelperClick(helper.id)}
                        disabled={disabled || runningHelper === helper.id}
                        className={`
                            w-full px-3 py-2 text-left text-sm transition-all border
                            ${disabled
                                ? 'opacity-40 cursor-not-allowed'
                                : isDarkMode
                                    ? 'hover:bg-[#404040] hover:border-brand-blue'
                                    : 'hover:bg-brand-blue-light-5 hover:border-brand-blue'}
                            ${runningHelper === helper.id
                                ? isDarkMode
                                    ? 'bg-brand-blue/20 animate-pulse border-brand-blue'
                                    : 'bg-brand-blue-light-2 animate-pulse border-brand-blue'
                                : isDarkMode
                                    ? 'bg-[#404040] border-transparent'
                                    : 'bg-white border-transparent'}
                            ${isDarkMode ? 'text-white' : 'text-brand-black'}
                        `}
                        title={helper.description}
                    >
                        <span className="mr-2">{helper.icon}</span>
                        {helper.label}
                        {helper.hasInput && <span className={`ml-1 text-xs ${isDarkMode ? 'text-[#888]' : 'text-brand-grey-4'}`}>...</span>}
                    </button>
                ))}
            </div>

            <hr className={`my-3 ${isDarkMode ? 'border-[#404040]' : 'border-brand-grey-7'}`} />

            {/* Backend/AI Helpers */}
            <div className="space-y-2">
                <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${isDarkMode ? 'text-brand-blue-light' : 'text-brand-blue'}`}>
                    AI Powered
                </p>
                {backendHelpers.map((helper) => (
                    <button
                        key={helper.id}
                        onClick={() => handleHelperClick(helper.id)}
                        disabled={disabled || runningHelper === helper.id}
                        className={`
                            w-full px-3 py-2 text-left text-sm transition-all border
                            ${disabled
                                ? 'opacity-40 cursor-not-allowed'
                                : isDarkMode
                                    ? 'hover:bg-[#404040] hover:border-brand-blue'
                                    : 'hover:bg-brand-blue-light-5 hover:border-brand-blue'}
                            ${runningHelper === helper.id
                                ? isDarkMode
                                    ? 'bg-brand-blue/20 animate-pulse border-brand-blue'
                                    : 'bg-brand-blue-light-2 animate-pulse border-brand-blue'
                                : isDarkMode
                                    ? 'bg-[#404040] border-transparent'
                                    : 'bg-white border-transparent'}
                            ${isDarkMode ? 'text-white' : 'text-brand-black'}
                        `}
                        title={helper.description}
                    >
                        <span className="mr-2">{helper.icon}</span>
                        {helper.label}
                    </button>
                ))}
            </div>

            {/* Helper hint */}
            <div className={`mt-6 p-3 border-l-4 border-brand-blue ${isDarkMode ? 'bg-brand-blue/10' : 'bg-brand-blue-light-5'}`}>
                <p className={`text-xs ${isDarkMode ? 'text-white' : 'text-brand-black'}`}>
                    💡 Helpers apply to all pages. Changes can be undone.
                </p>
            </div>
        </div>
    );
}
