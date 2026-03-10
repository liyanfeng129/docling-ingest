/**
 * Ingestion Context Provider
 * 
 * Implements the split context pattern from ADR-002 for fine-grained re-renders.
 * 
 * Architecture:
 * - Single reducer manages ALL state transitions (traceability)
 * - Split contexts per domain (fileQueue, document, preview, ui) for performance
 * - Dispatch context is separate and stable (never causes re-renders)
 * 
 * Usage:
 * ```jsx
 * <IngestionProvider>
 *   <IngestionPage />
 * </IngestionProvider>
 * ```
 * 
 * @see doc/ingestion/ADR.md ADR-002 for architectural decisions
 */

import { useReducer, useMemo } from 'react';
import { ingestionReducer, initialState } from './ingestionReducer';
import {
    FileQueueContext,
    DocumentContext,
    PreviewContext,
    UIContext,
    DispatchContext,
} from './contexts';

// Re-export contexts for convenience
export {
    FileQueueContext,
    DocumentContext,
    PreviewContext,
    UIContext,
    DispatchContext,
};

/**
 * Provider component that wraps the ingestion page
 * 
 * State is managed by a single reducer for atomic updates and traceability.
 * Each domain has its own context for fine-grained re-renders.
 */
export function IngestionProvider({ children }) {
    const [state, dispatch] = useReducer(ingestionReducer, initialState);

    // Memoize each domain slice to prevent unnecessary re-renders
    // React compares context values by reference - if the slice object
    // hasn't changed, consumers won't re-render

    const fileQueueValue = useMemo(() => state.fileQueue, [state.fileQueue]);
    const documentValue = useMemo(() => state.document, [state.document]);
    const previewValue = useMemo(() => state.preview, [state.preview]);
    const uiValue = useMemo(() => state.ui, [state.ui]);

    return (
        <DispatchContext.Provider value={dispatch}>
            <FileQueueContext.Provider value={fileQueueValue}>
                <DocumentContext.Provider value={documentValue}>
                    <PreviewContext.Provider value={previewValue}>
                        <UIContext.Provider value={uiValue}>
                            {children}
                        </UIContext.Provider>
                    </PreviewContext.Provider>
                </DocumentContext.Provider>
            </FileQueueContext.Provider>
        </DispatchContext.Provider>
    );
}

export default IngestionProvider;
