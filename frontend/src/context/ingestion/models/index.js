/**
 * Ingestion Context Data Models
 * 
 * This module re-exports all data model classes for the ingestion feature.
 * 
 * Usage:
 *   import { FileQueueModel, DocumentModel } from './models';
 *   // or
 *   import { UploadQueueItem, IngestedFileItem } from './models';
 * 
 * @see doc/ingestion/REFACTORING_PLAN_DATA_MODELS.md
 */

// FileQueue Domain
export {
    UploadQueueItem,
    IngestedFileItem,
    FileQueueModel,
} from './FileQueueModel';

// Document Domain
export {
    DocumentItem,
    DocumentPage,
    DocumentState,
    DocumentModel,
} from './DocumentModel';

// Preview Domain
export {
    PreviewConfig,
    PreviewModel,
} from './PreviewModel';

// UI Domain
export {
    UIModel,
} from './UIModel';
