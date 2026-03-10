/**
 * Ingestion Context Module
 * 
 * Central state management for the Ingestion Page using Context + Reducer pattern.
 * 
 * @see doc/ingestion/ADR.md ADR-002 for architectural decisions
 * @see doc/ingestion/REDUCER.md for reducer documentation
 * 
 * Exports:
 * - IngestionProvider: Provider component to wrap IngestionPage
 * - Hooks for accessing state and dispatch
 * - Constants for state values
 * - Action types for direct dispatch
 */

// Provider
export { IngestionProvider, default } from './IngestionProvider';

// Contexts (from dedicated contexts file)
export {
    FileQueueContext,
    DocumentContext,
    PreviewContext,
    UIContext,
    DispatchContext,
} from './contexts';

// Hooks
export {
    // Domain hooks
    useFileQueue,
    useDocument,
    usePreview,
    useUI,
    useDispatch,
    // Action creator hook
    useIngestionActions,
} from './hooks';

// Constants
export {
    DOC_STATUS,
    CONTENT_TYPE,
    UI_MODE,
    MODAL_TYPES,
} from './constants';

// Action Types (for direct dispatch if needed)
export * as ActionTypes from './actionTypes';

// Reducer (for testing)
export { ingestionReducer, initialState } from './ingestionReducer';
