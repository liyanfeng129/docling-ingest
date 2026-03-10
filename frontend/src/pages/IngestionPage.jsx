/**
 * IngestionPage
 *
 * Document ingestion workflow using Context + Reducer pattern.
 * This component is purely for LAYOUT - all business logic is in Connected components.
 *
 * Layout: Three-panel (File Queue | Content Viewer | Helper Panel)
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { toast } from 'react-toastify';

// Context and hooks
import {
    IngestionProvider,
    useUI,
    useFileQueue,
    useDocument,
    usePreview,
    useIngestionActions,
    MODAL_TYPES,
    DOC_STATUS,
    CONTENT_TYPE,
} from '../context/ingestion';

// External hooks
import useBackendConfig from '../hooks/useBackendConfig';
import useCommandHistory, { Commands, serializeCommand, getCommandDescription } from '../hooks/useCommandHistory';

// Utility functions
import {
    getUploadedFiles,
    getIngestedFiles,
    getFileContent,
    getFileHistory,
    getIngestedFileEmbeddings,
    saveFileContent,
    saveFileHistory,
    updateUploadedFile,
    createIngestedFile,
    checkIngestionDuplicate,
    generateIngestedId,
} from '../utils/fileCacheManager';
import { INGESTION_CONFIG } from '../config/ingestionConfig';
import { previewEmbeddings, startIngestion, generateImageDescriptions } from '../services/ingestionApi';

// Connected components (own their business logic)
import {
    ConnectedFileQueue,
    ConnectedUploadZone,
    ConnectedContentViewer,
    ConnectedHelperPanel,
} from '../components/ingestion';

// Pure UI components
import {
    SaveBar,
    EmbeddingPreviewViewer,
    CacheManagement,
    IngestionModal,
    RegexInputModal,
    HelperFileSelectModal,
} from '../components/ingestion';

// No Header component needed - standalone app

/**
 * Main IngestionPage Component
 * Wrapped with IngestionProvider for state management
 */
export default function IngestionPage() {
    return (
        <IngestionProvider>
            <IngestionPageLayout />
        </IngestionProvider>
    );
}

/**
 * Layout Component - Orchestrates the three-panel layout
 * Business logic is delegated to Connected components
 */
function IngestionPageLayout() {
    const { config: backendConfig, loading: configLoading, refetch: refetchConfig } = useBackendConfig();

    // Standalone mode - no auth, auto-detect theme
    const isDarkMode = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    const language = 'en';
    
    // Local UI state for title editing
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [editingTitleValue, setEditingTitleValue] = useState('');
    const [showCacheManagement, setShowCacheManagement] = useState(false);

    // Ref to track which document the current command history belongs to
    // This prevents saving history to wrong file during file switches
    const commandHistoryDocIdRef = useRef(null);

    // UI state from context
    const {
        leftSidebarCollapsed,
        rightSidebarCollapsed,
        isIngesting,
        ingestionProgress,
        activeModal,
        pendingHelper,
        multiSelectMode,
        checkedDocumentIds,
    } = useUI();

    const { uploadQueue, selectedDocumentId } = useFileQueue();
    const fileQueue = useFileQueue(); // Also get the model for method access
    const { currentPage, contentType, storedEmbeddings } = useDocument();
    const { isPreviewMode, embeddingPreview, isLoadingPreview, previewDocumentIds, previewConfig } = usePreview();
    const actions = useIngestionActions();

    // Memoized selector: only changes when the selected ingested file changes
    // This avoids re-running effects when unrelated files are added/removed
    const selectedIngestedFile = useMemo(
        () => selectedDocumentId ? fileQueue.getIngestedFileById(selectedDocumentId) : null,
        [fileQueue, selectedDocumentId]
    );

    // Shared command history for undo/redo (used by ContentViewer and HelperPanel)
    const {
        state: commandDocumentState,
        execute: executeCommand,
        undo,
        redo,
        reset: resetCommandDocument,
        restore: restoreCommandDocument,
        getFullState: getCommandFullState,
        canUndo,
        canRedo,
        lastAction,
        clearLastAction,
    } = useCommandHistory(null);

    // Translations for IngestionPage
    const ingestionTranslations = {
        en: {
            documentIngestion: 'Document Ingestion',
            expandSidebar: 'Expand sidebar',
            collapseSidebar: 'Collapse sidebar',
            multiSelect: 'Multi-Select',
            exitMultiSelect: 'Exit multi-select',
            enableMultiSelect: 'Enable multi-select',
            manageCache: 'Manage Cache',
            selectDocument: 'Select a document',
            pageOf: 'Page',
            of: 'of',
            loadingConfig: 'Loading configuration...',
            noDocumentsSelected: 'No documents selected',
            couldNotLoadDocument: 'Could not load document content',
            noItemsMatched: 'No items matched the pattern',
            itemsMatchedDeleted: 'item(s) matched and deleted',
            missingDocumentOrDb: 'Missing document or target database',
            missingTargetDb: 'Missing target database',
            noFilesToIngest: 'No files to ingest',
            cacheCleared: 'Cache cleared successfully',
            ingestionFailed: 'Ingestion failed',
            documentIngestedSuccess: 'Document ingested successfully to',
            allIngestionsFailed: 'All ingestions failed',
            ingested: 'ingested',
            skipped: 'skipped (duplicates)',
            failed: 'failed',
            successfullyIngested: 'Successfully ingested',
            file: 'file(s) to',
            allAlreadyIngested: 'All',
            alreadyIngested: 'file(s) were already ingested with the same content/strategy/db',
            helpers: 'Helpers',
            documents: 'Documents',
            clickToEditFilename: 'Click to edit filename',
            undo: 'Undo',
            redo: 'Redo',
            previewFailed: 'Preview failed',
            helperFailed: 'Helper failed',
            logoRemoved: 'logo(s)',
            logoRemovedFrom: 'removed from',
            imageDescriptionsGenerated: 'image description(s)',
            generatedFor: 'generated for',
            itemsRemovedFrom: 'item(s)',
            removedFrom: 'removed from',
            noItemsFound: 'No',
            foundInSelectedFiles: 'found in selected files',
        },
        de: {
            documentIngestion: 'Dokumenten-Erfassung',
            expandSidebar: 'Seitenleiste erweitern',
            collapseSidebar: 'Seitenleiste einklappen',
            multiSelect: 'Mehrfachauswahl',
            exitMultiSelect: 'Mehrfachauswahl beenden',
            enableMultiSelect: 'Mehrfachauswahl aktivieren',
            manageCache: 'Cache verwalten',
            selectDocument: 'Dokument auswählen',
            pageOf: 'Seite',
            of: 'von',
            loadingConfig: 'Konfiguration wird geladen...',
            noDocumentsSelected: 'Keine Dokumente ausgewählt',
            couldNotLoadDocument: 'Dokumentinhalt konnte nicht geladen werden',
            noItemsMatched: 'Keine Elemente entsprechen dem Muster',
            itemsMatchedDeleted: 'Element(e) gefunden und gelöscht',
            missingDocumentOrDb: 'Dokument oder Zieldatenbank fehlt',
            missingTargetDb: 'Zieldatenbank fehlt',
            noFilesToIngest: 'Keine Dateien zum Erfassen',
            cacheCleared: 'Cache erfolgreich geleert',
            ingestionFailed: 'Erfassung fehlgeschlagen',
            documentIngestedSuccess: 'Dokument erfolgreich erfasst in',
            allIngestionsFailed: 'Alle Erfassungen fehlgeschlagen',
            ingested: 'erfasst',
            skipped: 'übersprungen (Duplikate)',
            failed: 'fehlgeschlagen',
            successfullyIngested: 'Erfolgreich erfasst',
            file: 'Datei(en) in',
            allAlreadyIngested: 'Alle',
            alreadyIngested: 'Datei(en) wurden bereits mit gleichem Inhalt/Strategie/DB erfasst',
            helpers: 'Hilfsfunktionen',
            documents: 'Dokumente',
            clickToEditFilename: 'Klicken zum Bearbeiten des Dateinamens',
            undo: 'Rückgängig',
            redo: 'Wiederholen',
            previewFailed: 'Vorschau fehlgeschlagen',
            helperFailed: 'Hilfsfunktion fehlgeschlagen',
            logoRemoved: 'Logo(s)',
            logoRemovedFrom: 'entfernt aus',
            imageDescriptionsGenerated: 'Bildbeschreibung(en)',
            generatedFor: 'erstellt für',
            itemsRemovedFrom: 'Element(e)',
            removedFrom: 'entfernt aus',
            noItemsFound: 'Keine',
            foundInSelectedFiles: 'in ausgewählten Dateien gefunden',
        },
    };
    const t = ingestionTranslations[language] || ingestionTranslations.en;

    // Show toast notification when undo/redo happens
    useEffect(() => {
        if (lastAction) {
            const actionType = lastAction.type === 'undo' ? t.undo : t.redo;
            const description = getCommandDescription(lastAction.command);
            toast.info(`${actionType}: ${description}`, {
                position: 'bottom-center',
                autoClose: 2000,
                hideProgressBar: true,
                closeOnClick: true,
                pauseOnHover: false,
                draggable: false,
                icon: lastAction.type === 'undo' ? '↩️' : '↪️',
            });
            clearLastAction();
        }
    }, [lastAction, clearLastAction]);

    // Auto-save document content and command history
    // Only save when the current command history belongs to the selected document
    // Use commandDocumentState directly (source of truth for editing)
    useEffect(() => {
        if (commandDocumentState && selectedDocumentId && commandHistoryDocIdRef.current === selectedDocumentId) {
            saveFileContent(selectedDocumentId, commandDocumentState);
            // Save serialized command history for undo/redo persistence
            const fullState = getCommandFullState();
            saveFileHistory(selectedDocumentId, fullState);
            updateUploadedFile(selectedDocumentId, { filename: commandDocumentState.filename });
        }
    }, [commandDocumentState, selectedDocumentId, getCommandFullState]);

    // ===== Initialization Effects =====

    // Load cached files on mount
    useEffect(() => {
        // Load uploaded files from cache
        const cachedUploadedFiles = getUploadedFiles();
        if (cachedUploadedFiles.length > 0) {
            const restoredQueue = cachedUploadedFiles.map(f => ({
                id: f.id || `cached_${f.documentId}`,
                documentId: f.documentId,
                filename: f.filename,
                status: f.status || DOC_STATUS.READY,
                progress: 100,
            }));
            actions.restoreFilesFromCache(restoredQueue);
        }

        // Load ingested files from cache
        const cachedIngestedFiles = getIngestedFiles();
        actions.loadIngestedFiles(cachedIngestedFiles);

        // ...existing code...
    }, [actions, resetCommandDocument]);

    // Load document content when file is selected
    useEffect(() => {
        console.log('[IngestionPage] useEffect triggered, selectedDocumentId:', selectedDocumentId);

        if (!selectedDocumentId) {
            // No file selected - reset document state and clear ref
            console.log('[IngestionPage] No document selected, resetting');
            commandHistoryDocIdRef.current = null;
            resetCommandDocument(null);
            actions.resetDocument();
            return;
        }

        // Use the memoized selector - only re-runs when the specific ingested file changes
        if (selectedIngestedFile) {
            // Load embeddings for ingested file - no command history for these
            console.log('[IngestionPage] Loading ingested file:', selectedIngestedFile.ingestedId);
            commandHistoryDocIdRef.current = null;
            const embeddings = getIngestedFileEmbeddings(selectedIngestedFile.ingestedId);
            if (embeddings) {
                // This sets contentType to EMBEDDING and clears documentState
                actions.setStoredEmbeddings(embeddings, selectedDocumentId);
                resetCommandDocument(null); // No editing for ingested files
            }
            return;
        }

        // Load document content from cache (uploaded file)
        const content = getFileContent(selectedDocumentId);
        console.log('[IngestionPage] Loading content for:', selectedDocumentId, 'found:', !!content, 'pages:', content?.pages?.length);

        if (content) {
            // Try to restore command history (undo/redo) for this file
            const savedHistory = getFileHistory(selectedDocumentId);
            if (savedHistory && (savedHistory.past?.length > 0 || savedHistory.future?.length > 0)) {
                // Restore full state with history
                console.log('[IngestionPage] Restoring with history');
                restoreCommandDocument({
                    past: savedHistory.past || [],
                    present: content,
                    future: savedHistory.future || [],
                });
            } else {
                // No history - start fresh
                console.log('[IngestionPage] Resetting with fresh content');
                resetCommandDocument(content);
            }
            // Mark this document as the one owning the current command history
            // This prevents auto-save from saving to wrong file during transitions
            commandHistoryDocIdRef.current = selectedDocumentId;
            actions.loadDocument(content, selectedDocumentId);
        } else {
            console.warn('[IngestionPage] No content found in cache for:', selectedDocumentId);
        }
    }, [selectedDocumentId, selectedIngestedFile, actions, resetCommandDocument, restoreCommandDocument]);

    // ===== Modal Handlers =====

    const handleCloseModal = useCallback(() => {
        actions.closeModal();
    }, [actions]);

    const handleShowPreview = useCallback(async (targetDb, strategy) => {
        // Determine which documents to preview
        // If multi-select mode with checked files, use those; otherwise use current file
        const documentIdsToPreview = multiSelectMode && checkedDocumentIds.size > 0
            ? Array.from(checkedDocumentIds)
            : [selectedDocumentId];

        if (documentIdsToPreview.length === 0 || !documentIdsToPreview[0]) {
            toast.error(t.noDocumentsSelected);
            return;
        }

        // Get the first document to generate initial preview
        const firstDocId = documentIdsToPreview[0];
        const firstDocContent = getFileContent(firstDocId);

        if (!firstDocContent) {
            toast.error(t.couldNotLoadDocument);
            return;
        }

        // Start preview mode with all selected documents
        actions.startPreview(targetDb, strategy, documentIdsToPreview, rightSidebarCollapsed);

        try {
            // Call API to generate preview embeddings for first document
            const result = await previewEmbeddings(strategy, firstDocContent);

            if (result.success) {
                actions.setPreviewGenerated(result.preview);
                // Also select the first document
                actions.selectFile(firstDocId);
            } else {
                throw new Error(result.error || 'Failed to generate preview');
            }
        } catch (error) {
            console.error('Preview generation failed:', error);
            toast.error(`${t.previewFailed}: ${error.message}`);
            actions.failPreview(rightSidebarCollapsed);
        }
    }, [multiSelectMode, checkedDocumentIds, selectedDocumentId, rightSidebarCollapsed, actions]);

    const handleRegexConfirm = useCallback((pattern) => {
        if (!commandDocumentState) return;

        const regex = new RegExp(pattern, 'i');
        const matchingIds = [];

        for (const page of commandDocumentState.pages) {
            for (const item of page.items) {
                if (item.type === 'text' && !item.deleted && regex.test(item.content)) {
                    matchingIds.push(item.id);
                }
            }
        }

        if (matchingIds.length > 0) {
            executeCommand(Commands.batchDelete(matchingIds));
            toast.success(`${matchingIds.length} ${t.itemsMatchedDeleted}`);
        } else {
            toast.info(t.noItemsMatched);
        }
        actions.closeModal();
    }, [commandDocumentState, executeCommand, actions]);

    const handleHelperFileSelectConfirm = useCallback(async (selectedDocumentIds) => {
        actions.closeModal();

        if (!pendingHelper || !selectedDocumentIds || selectedDocumentIds.length === 0) {
            actions.clearPendingHelper();
            return;
        }

        actions.startHelper(pendingHelper.id);

        try {
            let totalAffected = 0;
            let filesProcessed = 0;

            // Process each selected file
            for (const docId of selectedDocumentIds) {
                const isCurrentDocument = docId === selectedDocumentId;

                // Get document content
                // For current document, use commandDocumentState (source of truth)
                // For other documents, load from cache
                const docContent = isCurrentDocument && commandDocumentState
                    ? commandDocumentState
                    : getFileContent(docId);

                if (!docContent || !docContent.pages) {
                    console.warn(`[Helper] No content found for document: ${docId}`);
                    continue;
                }

                let affectedIds = [];

                // Collect items to modify based on helper type
                switch (pendingHelper.id) {
                    case 'remove_logos': {
                        for (const page of docContent.pages) {
                            for (const item of page.items) {
                                if ((item.type === 'image' || item.type === 'picture') && item.classification === 'logo' && !item.deleted) {
                                    affectedIds.push(item.id);
                                }
                            }
                        }
                        break;
                    }

                    case 'remove_empty': {
                        for (const page of docContent.pages) {
                            for (const item of page.items) {
                                if (item.type === 'text' && !item.deleted) {
                                    const trimmed = item.content.trim();
                                    if (!trimmed || trimmed.length <= 1) {
                                        affectedIds.push(item.id);
                                    }
                                }
                            }
                        }
                        break;
                    }

                    case 'ai_image_descriptions': {
                        // Collect all images from this document
                        const images = [];
                        for (const page of docContent.pages) {
                            for (const item of page.items) {
                                if ((item.type === 'image' || item.type === 'picture') && !item.deleted) {
                                    images.push({
                                        id: item.id,
                                        imageUrl: item.imageUrl,
                                        classification: item.classification || 'unclassified',
                                        pageNumber: page.pageNumber,
                                    });
                                }
                            }
                        }

                        if (images.length > 0) {
                            // Call backend to generate descriptions
                            const result = await generateImageDescriptions(docId, images);

                            if (result.success && result.descriptions) {
                                // Create insertions: new text items after each image
                                const insertions = result.descriptions
                                    .filter(d => d.description)
                                    .map(d => ({
                                        afterItemId: d.imageId,
                                        newItem: {
                                            id: `desc_${d.imageId}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                                            type: 'text',
                                            content: `**Image Description:** ${d.description}`,
                                            deleted: false,
                                        },
                                    }));

                                if (insertions.length > 0) {
                                    const command = Commands.batchInsertAfter(insertions);

                                    if (isCurrentDocument) {
                                        executeCommand(command);
                                    } else {
                                        // Execute on non-current document
                                        const newContent = command.execute(docContent);
                                        const existingHistory = getFileHistory(docId) || { past: [], future: [] };
                                        const serializedCmd = serializeCommand(command);
                                        const newHistory = {
                                            past: [...existingHistory.past, serializedCmd],
                                            future: [],
                                        };
                                        saveFileContent(docId, newContent);
                                        saveFileHistory(docId, newHistory);
                                    }
                                    totalAffected += insertions.length;
                                }
                            }
                        }
                        filesProcessed++;
                        continue; // Skip the default batchDelete logic below
                    }

                    default:
                        break;
                }

                if (affectedIds.length > 0) {
                    // Create the command
                    const command = Commands.batchDelete(affectedIds);

                    if (isCurrentDocument) {
                        // For current document, use the hook (updates UI immediately)
                        executeCommand(command);
                    } else {
                        // For other documents, execute command and save with history
                        // 1. Execute command to get new state
                        const newContent = command.execute(docContent);

                        // 2. Load existing history (or create empty)
                        const existingHistory = getFileHistory(docId) || { past: [], future: [] };

                        // 3. Add command to past (serialized), clear future
                        const serializedCmd = serializeCommand(command);
                        const newHistory = {
                            past: [...existingHistory.past, serializedCmd],
                            future: [], // Clear redo stack when new command is executed
                        };

                        // 4. Save both content and history
                        saveFileContent(docId, newContent);
                        saveFileHistory(docId, newHistory);
                    }
                    totalAffected += affectedIds.length;
                }
                filesProcessed++;
            }

            // Show result
            let helperLabel;
            let actionVerb;
            if (pendingHelper.id === 'remove_logos') {
                helperLabel = t.logoRemoved;
                actionVerb = t.logoRemovedFrom;
            } else if (pendingHelper.id === 'ai_image_descriptions') {
                helperLabel = t.imageDescriptionsGenerated;
                actionVerb = t.generatedFor;
            } else {
                helperLabel = t.itemsRemovedFrom;
                actionVerb = t.removedFrom;
            }

            if (totalAffected > 0) {
                toast.success(`${totalAffected} ${helperLabel} ${actionVerb} ${filesProcessed} file(s)`);
            } else {
                toast.info(`${t.noItemsFound} ${helperLabel} ${t.foundInSelectedFiles}`);
            }

            actions.completeHelper();
        } catch (error) {
            console.error('Helper failed:', error);
            toast.error(t.helperFailed + ': ' + error.message);
            actions.failHelper();
        }

        actions.clearPendingHelper();
    }, [actions, pendingHelper, selectedDocumentId, commandDocumentState, executeCommand]);

    // Confirm and ingest (single file)
    const handleConfirmIngestion = useCallback(async () => {
        if (!commandDocumentState || !previewConfig.targetDb) {
            toast.error(t.missingDocumentOrDb);
            return;
        }

        // Check for duplicate ingestion (same content + strategy + targetDb)
        const { isDuplicate, existingEntry, ingestionId } = checkIngestionDuplicate(
            commandDocumentState,
            previewConfig.strategy,
            previewConfig.targetDb
        );

        if (isDuplicate) {
            toast.warning(
                `This exact content was already ingested to ${previewConfig.targetDb} with ${previewConfig.strategy} strategy on ${new Date(existingEntry.timestamp).toLocaleString()}`,
                { autoClose: 5000 }
            );
            return;
        }

        // Start ingestion (sets isIngesting: true)
        actions.startIngestion();

        try {
            // Send pre-transformed documents from preview (not raw documentState)
            const result = await startIngestion(
                previewConfig.targetDb,
                embeddingPreview.documents,
                previewConfig.strategy,
                { source: commandDocumentState.filename }
            );

            if (result.success) {
                // Generate ingestedId (content + strategy) for sidebar grouping
                const ingestedId = generateIngestedId(commandDocumentState, previewConfig.strategy);

                // Create ingested entry in cache with both IDs
                const ingestedEntry = createIngestedFile(
                    selectedDocumentId,
                    previewConfig.strategy,
                    embeddingPreview,
                    { filename: commandDocumentState.filename, documentId: selectedDocumentId },
                    previewConfig.targetDb,
                    ingestionId,  // contentHash_strategy_targetDb (duplicate detection)
                    ingestedId    // contentHash_strategy (sidebar grouping)
                );

                // Update state
                actions.completeIngestion(
                    selectedDocumentId,
                    ingestedEntry,
                    embeddingPreview,
                    rightSidebarCollapsed
                );

                toast.success(`${t.documentIngestedSuccess} ${previewConfig.targetDb}`);
            } else {
                throw new Error(result.error || 'Ingestion failed');
            }
        } catch (error) {
            console.error('Ingestion failed:', error);
            toast.error(`${t.ingestionFailed}: ${error.message}`);
            actions.failIngestion();
        }
    }, [commandDocumentState, selectedDocumentId, previewConfig, embeddingPreview, rightSidebarCollapsed, actions]);

    // Confirm and ingest all files in preview
    const handleConfirmIngestionAll = useCallback(async () => {
        if (!previewConfig.targetDb) {
            toast.error(t.missingTargetDb);
            return;
        }

        const documentIds = Array.from(previewDocumentIds);
        if (documentIds.length === 0) {
            toast.error(t.noFilesToIngest);
            return;
        }

        // Start ingestion
        actions.startIngestion();

        let successCount = 0;
        let failCount = 0;
        let skipCount = 0;
        const ingestedEntries = [];

        for (let i = 0; i < documentIds.length; i++) {
            const docId = documentIds[i];
            const content = getFileContent(docId);

            if (!content) {
                console.error(`No content found for document ${docId}`);
                failCount++;
                continue;
            }

            // Check for duplicate ingestion
            const { isDuplicate, ingestionId } = checkIngestionDuplicate(
                content,
                previewConfig.strategy,
                previewConfig.targetDb
            );

            if (isDuplicate) {
                console.info(`Skipping duplicate: ${docId} already ingested with same content/strategy/db`);
                skipCount++;
                continue;
            }

            // Update progress
            actions.updateIngestionProgress(Math.round(((i) / documentIds.length) * 100));

            try {
                // Generate preview first to get transformed documents
                let filePreview = null;
                try {
                    const previewResult = await previewEmbeddings(previewConfig.strategy, content);
                    if (previewResult.success) {
                        filePreview = previewResult.preview;
                    }
                } catch (previewError) {
                    console.warn(`Could not generate preview for ${docId}:`, previewError);
                }

                // Send pre-transformed documents from preview
                const documentsToIngest = filePreview?.documents || content;
                const result = await startIngestion(
                    previewConfig.targetDb,
                    documentsToIngest,
                    previewConfig.strategy,
                    { source: content.filename }
                );

                if (result.success) {
                    // Generate ingestedId (content + strategy) for sidebar grouping
                    const ingestedId = generateIngestedId(content, previewConfig.strategy);

                    // Create ingested entry in cache with both IDs
                    const ingestedEntry = createIngestedFile(
                        docId,
                        previewConfig.strategy,
                        filePreview,
                        { filename: content.filename, documentId: docId },
                        previewConfig.targetDb,
                        ingestionId,  // contentHash_strategy_targetDb (duplicate detection)
                        ingestedId    // contentHash_strategy (sidebar grouping)
                    );

                    // Collect all ingested entries
                    ingestedEntries.push(ingestedEntry);
                    successCount++;
                } else {
                    console.error(`Ingestion failed for ${docId}:`, result.error);
                    failCount++;
                }
            } catch (error) {
                console.error(`Ingestion error for ${docId}:`, error);
                failCount++;
            }
        }

        // Complete batch ingestion
        if (successCount > 0) {
            actions.completeBatchIngestion(ingestedEntries, rightSidebarCollapsed);

            if (failCount > 0 || skipCount > 0) {
                const parts = [];
                parts.push(`${successCount} ${t.ingested}`);
                if (skipCount > 0) parts.push(`${skipCount} ${t.skipped}`);
                if (failCount > 0) parts.push(`${failCount} ${t.failed}`);
                toast.warning(parts.join(', '));
            } else {
                toast.success(`${t.successfullyIngested} ${successCount} ${t.file} ${previewConfig.targetDb}`);
            }
        } else if (skipCount > 0 && failCount === 0) {
            actions.failIngestion();
            toast.info(`${t.allAlreadyIngested} ${skipCount} ${t.alreadyIngested}`);
        } else {
            actions.failIngestion();
            toast.error(t.allIngestionsFailed);
        }
    }, [previewDocumentIds, previewConfig, rightSidebarCollapsed, actions]);

    // Cache cleared handler
    const handleCacheCleared = useCallback(() => {
        // Reset UI state when cache is cleared
        actions.clearAllFiles();
        resetCommandDocument(null);
        toast.success(t.cacheCleared);
    }, [actions, resetCommandDocument]);

    // Keyboard shortcuts for undo/redo
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Ctrl/Cmd + Z = Undo
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                if (canUndo) {
                    undo();
                }
            }
            // Ctrl/Cmd + Shift + Z = Redo
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
                e.preventDefault();
                if (canRedo) {
                    redo();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [canUndo, canRedo, undo, redo]);

    // ===== Render =====

    const totalPages = commandDocumentState?.pages?.length || 0;

    return (
        <div className={`h-screen flex flex-col overflow-hidden font-display ${isDarkMode ? 'bg-[#212121]' : 'bg-brand-blue-light-5'}`}>
            {/* Header */}
            <div className={`flex-shrink-0 h-14 flex items-center px-6 border-b ${isDarkMode ? 'bg-[#2d2d2d] border-[#404040] text-white' : 'bg-white border-brand-grey-7 text-brand-blue'}`}>
                <h1 className="text-lg font-semibold">Docling Ingest</h1>
            </div>

            {/* Main area: three-panel layout - takes remaining space */}
            <div className={`flex flex-1 min-h-0 overflow-hidden`}>
                {/* Left Panel - File Queue */}
                <div
                    className={`
                        ${leftSidebarCollapsed ? 'w-12' : 'w-56 lg:w-64'} 
                        ${isDarkMode ? 'bg-[#2d2d2d] border-[#404040]' : 'bg-brand-blue-light-4 border-brand-grey-7'}
                        flex flex-col border-r 
                        transition-all duration-300 ease-in-out flex-shrink-0
                    `}
                >
                    {/* Header with toggle */}
                    <div className={`p-4 flex items-center ${leftSidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
                        {!leftSidebarCollapsed && (
                            <h2 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-brand-blue'}`}>{t.documentIngestion}</h2>
                        )}
                        <button
                            onClick={() => actions.toggleLeftSidebar()}
                            className={`w-8 h-8 border flex items-center justify-center transition-colors
                                ${isDarkMode 
                                    ? 'bg-[#404040] border-[#555] hover:bg-[#4a4a4a] text-white' 
                                    : 'bg-white/50 border-brand-grey-7 hover:bg-white text-brand-black'
                                }`}
                            title={leftSidebarCollapsed ? t.expandSidebar : t.collapseSidebar}
                        >
                            <span className="text-sm font-bold">
                                {leftSidebarCollapsed ? '»' : '«'}
                            </span>
                        </button>
                    </div>

                    {!leftSidebarCollapsed && (
                        <div className="px-4 pb-4 flex flex-col flex-1 overflow-hidden pt-4">
                            {/* Upload Zone */}
                            <ConnectedUploadZone
                                resetCommandDocument={resetCommandDocument}
                                isDarkMode={isDarkMode}
                            />

                            {/* Multi-select toggle (disabled in preview mode) */}
                            {!isPreviewMode && (
                                <div className="mt-3 flex items-center justify-between">
                                    <button
                                        onClick={() => actions.toggleMultiSelect()}
                                        disabled={isPreviewMode}
                                        className={`text-xs px-2 py-1 rounded transition-colors 
                                            ${multiSelectMode
                                                ? 'bg-brand-blue text-white'
                                                : isDarkMode 
                                                    ? 'bg-[#404040] text-[#b0b0b0] hover:bg-[#4a4a4a]' 
                                                    : 'bg-brand-grey-9 text-brand-grey-3 hover:bg-brand-grey-8'
                                            } 
                                            ${isPreviewMode ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        title={multiSelectMode ? t.exitMultiSelect : t.enableMultiSelect}
                                    >
                                        {multiSelectMode ? `✓ ${t.multiSelect}` : `☐ ${t.multiSelect}`}
                                    </button>
                                </div>
                            )}

                            {/* File Queue */}
                            <div className="mt-3 flex-1 overflow-y-auto">
                                <ConnectedFileQueue isDarkMode={isDarkMode} />
                            </div>

                            {/* Bottom Actions */}
                            <div className={`mt-3 pt-3 border-t space-y-2 ${isDarkMode ? 'border-[#404040]' : 'border-brand-grey-7'}`}>
                                {/* Cache Management Button */}
                                <button
                                    onClick={() => setShowCacheManagement(true)}
                                    disabled={isPreviewMode}
                                    className={`w-full text-xs px-3 py-2 rounded-lg transition-colors
                                        flex items-center justify-center gap-2
                                        ${isDarkMode 
                                            ? 'bg-[#404040] text-[#b0b0b0] hover:bg-[#4a4a4a] hover:text-white' 
                                            : 'bg-brand-grey-9 text-brand-grey-3 hover:bg-brand-grey-8 hover:text-brand-black'
                                        }
                                        ${isPreviewMode ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                    {t.manageCache}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Collapsed state icon */}
                    {leftSidebarCollapsed && (
                        <div className="flex flex-col items-center pt-4">
                            <span className="text-2xl mb-2" title={t.documents}>📄</span>
                            <span className={`text-xs ${isDarkMode ? 'text-[#b0b0b0]' : 'text-brand-grey-3'}`}>
                                {uploadQueue.length > 0 && `${uploadQueue.length}`}
                            </span>
                        </div>
                    )}
                </div>

                {/* Main Content Area */}
                <main className="flex-1 flex flex-col overflow-hidden">
                    {/* Header / Save Bar - hidden in preview mode, different for embedding mode */}
                    {!isPreviewMode && contentType !== CONTENT_TYPE.EMBEDDING && (
                        <div className={`border-b px-6 py-4 ${isDarkMode ? 'bg-[#2d2d2d] border-[#404040]' : 'bg-white border-brand-grey-7'}`}>
                            {/* Title row */}
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex-1">
                                    {commandDocumentState ? (
                                        isEditingTitle ? (
                                            <input
                                                type="text"
                                                value={editingTitleValue}
                                                onChange={(e) => setEditingTitleValue(e.target.value)}
                                                onBlur={() => {
                                                    const trimmed = editingTitleValue.trim();
                                                    if (trimmed && trimmed !== commandDocumentState.filename) {
                                                        executeCommand(Commands.renameDocument(trimmed, commandDocumentState.filename));
                                                        actions.updateFilename(selectedDocumentId, trimmed);
                                                    }
                                                    setIsEditingTitle(false);
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.target.blur();
                                                    } else if (e.key === 'Escape') {
                                                        setEditingTitleValue(commandDocumentState.filename);
                                                        setIsEditingTitle(false);
                                                    }
                                                }}
                                                autoFocus
                                                className={`w-full text-xl font-bold border px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-blue
                                                    ${isDarkMode 
                                                        ? 'text-white bg-[#404040] border-[#555]' 
                                                        : 'text-brand-black bg-white border-brand-blue'
                                                    }`}
                                            />
                                        ) : (
                                            <h1
                                                className={`text-xl font-bold cursor-text px-3 py-2 -mx-3 -my-2 transition-colors border border-transparent
                                                    ${isDarkMode 
                                                        ? 'text-white hover:bg-[#404040] hover:border-[#555]' 
                                                        : 'text-brand-black hover:bg-brand-blue-light-5 hover:border-brand-grey-7'
                                                    }`}
                                                onClick={() => {
                                                    setEditingTitleValue(commandDocumentState.filename);
                                                    setIsEditingTitle(true);
                                                }}
                                                title={t.clickToEditFilename}
                                            >
                                                {commandDocumentState.filename}
                                            </h1>
                                        )
                                    ) : (
                                        <h1 className={`text-xl font-bold px-3 py-2 -mx-3 -my-2 ${isDarkMode ? 'text-[#888]' : 'text-brand-grey-4'}`}>
                                            {t.selectDocument}
                                        </h1>
                                    )}
                                </div>
                            </div>

                            {/* Actions row */}
                            <div className="flex items-center justify-between">
                                {commandDocumentState && (
                                    <p className={`text-sm ${isDarkMode ? 'text-[#b0b0b0]' : 'text-brand-grey-4'}`}>
                                        {t.pageOf} {currentPage} {t.of} {totalPages}
                                    </p>
                                )}
                                {!commandDocumentState && <div />}

                                <SaveBar
                                    canUndo={canUndo}
                                    canRedo={canRedo}
                                    onUndo={undo}
                                    onRedo={redo}
                                    onIngest={() => actions.openModal(MODAL_TYPES.INGEST)}
                                    canIngest={!!commandDocumentState && !isIngesting && !isPreviewMode}
                                    isDarkMode={isDarkMode}
                                />
                            </div>
                        </div>
                    )}

                    {/* Content Viewer or Preview Viewer */}
                    {configLoading ? (
                        <div className="flex-1 flex items-center justify-center">
                            <div className={isDarkMode ? 'text-[#b0b0b0]' : 'text-brand-grey-4'}>{t.loadingConfig}</div>
                        </div>
                    ) : isPreviewMode ? (
                        <EmbeddingPreviewViewer
                            preview={embeddingPreview}
                            isLoading={isLoadingPreview}
                            isIngesting={isIngesting}
                            onCancel={() => actions.exitPreviewMode(rightSidebarCollapsed)}
                            onConfirm={handleConfirmIngestion}
                            onConfirmAll={handleConfirmIngestionAll}
                            isMultiFile={previewDocumentIds.size > 1}
                            totalFilesInPreview={previewDocumentIds.size}
                            isDarkMode={isDarkMode}
                        />
                    ) : contentType === CONTENT_TYPE.EMBEDDING && storedEmbeddings ? (
                        <EmbeddingPreviewViewer
                            preview={storedEmbeddings}
                            isLoading={false}
                            readOnly={true}
                            isDarkMode={isDarkMode}
                        />
                    ) : (
                        <ConnectedContentViewer
                            commandState={commandDocumentState}
                            executeCommand={executeCommand}
                            isDarkMode={isDarkMode}
                        />
                    )}
                </main>

                {/* Right Panel - Helpers (hidden in preview mode and embedding mode) */}
                {!isPreviewMode && contentType !== CONTENT_TYPE.EMBEDDING && (
                    <div
                        className={`
                            ${rightSidebarCollapsed ? 'w-12' : 'w-56 lg:w-64'} 
                            ${isDarkMode ? 'bg-[#2d2d2d] border-[#404040]' : 'bg-white border-brand-grey-7'}
                            border-l flex flex-col
                            transition-all duration-300 ease-in-out flex-shrink-0
                        `}
                    >
                        {/* Header with toggle */}
                        <div className={`p-4 flex items-center ${rightSidebarCollapsed ? 'justify-center' : 'justify-between'} border-b ${isDarkMode ? 'border-[#404040]' : 'border-brand-grey-7'}`}>
                            <button
                                onClick={() => actions.toggleRightSidebar()}
                                className={`w-8 h-8 border flex items-center justify-center transition-colors
                                    ${isDarkMode 
                                        ? 'bg-[#404040] border-[#555] hover:bg-[#4a4a4a]' 
                                        : 'bg-brand-blue-light-5 border-brand-grey-7 hover:bg-brand-blue-light-3'
                                    }`}
                                title={rightSidebarCollapsed ? t.expandSidebar : t.collapseSidebar}
                            >
                                <span className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-brand-blue'}`}>
                                    {rightSidebarCollapsed ? '«' : '»'}
                                </span>
                            </button>
                            {!rightSidebarCollapsed && (
                                <h3 className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-brand-blue'}`}>{t.helpers}</h3>
                            )}
                        </div>

                        {/* Content: Helpers */}
                        {!rightSidebarCollapsed && (
                            <ConnectedHelperPanel
                                commandState={commandDocumentState}
                                executeCommand={executeCommand}
                                isDarkMode={isDarkMode}
                            />
                        )}

                        {/* Collapsed state icon */}
                        {rightSidebarCollapsed && (
                            <div className="flex flex-col items-center pt-4">
                                <span className="text-2xl" title={t.helpers}>🛠️</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Ingestion Modal */}
            <IngestionModal
                isOpen={activeModal === MODAL_TYPES.INGEST}
                onClose={handleCloseModal}
                onShowPreview={handleShowPreview}
                onCollectionCreated={refetchConfig}
                backendConfig={backendConfig}
                isIngesting={isIngesting}
                progress={ingestionProgress}
                isDarkMode={isDarkMode}
            />

            {/* Regex Input Modal */}
            <RegexInputModal
                isOpen={activeModal === MODAL_TYPES.REGEX}
                onClose={handleCloseModal}
                onConfirm={handleRegexConfirm}
                isDarkMode={isDarkMode}
            />

            {/* Cache Management Modal */}
            {showCacheManagement && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={() => setShowCacheManagement(false)}
                    />
                    <div className={`relative rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden
                        ${isDarkMode ? 'bg-[#2d2d2d]' : 'bg-white'}`}>
                        <CacheManagement
                            onClose={() => setShowCacheManagement(false)}
                            onCacheCleared={handleCacheCleared}
                            isDarkMode={isDarkMode}
                        />
                    </div>
                </div>
            )}

            {/* Helper File Selection Modal */}
            <HelperFileSelectModal
                isOpen={activeModal === MODAL_TYPES.HELPER_FILE_SELECT}
                onClose={handleCloseModal}
                onConfirm={handleHelperFileSelectConfirm}
                files={uploadQueue.filter(f => f.status === DOC_STATUS.READY)}
                helper={pendingHelper}
                currentDocumentId={selectedDocumentId}
                currentFilename={commandDocumentState?.filename}
                isDarkMode={isDarkMode}
            />
        </div>
    );
}
