/**
 * FileQueueItem Component
 * 
 * Displays a single file in the upload queue with status and progress.
 * Supports removable mode with hover X button.
 */

import { useState } from 'react';
import { DOC_STATUS } from '../../../context/ingestion';

/**
 * Get status icon for document
 * @param {string} status - Document status
 * @returns {string} - Emoji icon
 */
const getStatusIcon = (status) => {
    switch (status) {
        case DOC_STATUS.COMPLETED:
            return '✅';
        case DOC_STATUS.INGESTED:
            return '🧠';
        case DOC_STATUS.ERROR:
            return '❌';
        case DOC_STATUS.READY:
            return '📋';
        case DOC_STATUS.QUEUED:
        case DOC_STATUS.UPLOADING:
        case DOC_STATUS.PROCESSING:
        case DOC_STATUS.INGESTING:
            return '⏳';
        default:
            return '📄';
    }
};

/**
 * @param {Object} props
 * @param {Object} props.doc - Document object
 * @param {boolean} props.isSelected - Whether this document is selected
 * @param {boolean} props.isChecked - Whether this document is checked (multi-select)
 * @param {boolean} props.isLoading - Whether this document is being loaded (preview switching)
 * @param {Function} props.onSelect - Selection handler
 * @param {Function} props.onCheck - Check handler for multi-select
 * @param {boolean} props.showCheckbox - Whether to show checkbox for multi-select
 * @param {boolean} props.removableMode - Whether to show hover X for removal
 * @param {Function} props.onRemoveFromSelection - Handler for removing from selection (for preview mode)
 */
export default function FileQueueItem({
    doc,
    isSelected = false,
    isChecked = false,
    isLoading = false,
    onSelect,
    onCheck,
    showCheckbox = false,
    removableMode = false,
    onRemoveFromSelection,
}) {
    const [isHovered, setIsHovered] = useState(false);

    const showProgress = [DOC_STATUS.UPLOADING, DOC_STATUS.PROCESSING, DOC_STATUS.INGESTING].includes(doc.status);

    const handleRemoveClick = (e) => {
        e.stopPropagation();
        if (onRemoveFromSelection) {
            onRemoveFromSelection(doc.documentId);
        }
    };

    return (
        <li
            className={`
                relative p-3 cursor-pointer transition-all border-b border-white group
                ${isLoading ? 'opacity-70 cursor-wait' : ''}
                ${isSelected
                    ? 'bg-brand-blue/20 text-brand-black shadow-inner border-l-4 border-brand-blue'
                    : isChecked
                        ? 'bg-brand-blue-light-3 text-brand-black border-l-4 border-transparent'
                        : 'bg-brand-blue-light-5 hover:bg-brand-blue-light-3 text-brand-black border-l-4 border-transparent'}
            `}
            onClick={() => !isLoading && doc.documentId && onSelect && onSelect(doc.documentId)}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className="flex items-center justify-between">
                {/* Checkbox for multi-select */}
                {showCheckbox && (
                    <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                            e.stopPropagation();
                            onCheck && onCheck(doc.documentId);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className={`
                            w-4 h-4 mr-2 rounded border-brand-grey-4 cursor-pointer
                            text-brand-blue focus:ring-1 focus:ring-brand-blue
                        `}
                    />
                )}

                {/* Loading spinner */}
                {isLoading && (
                    <svg className="animate-spin w-4 h-4 mr-2 text-brand-blue" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                )}

                <span
                    className={`text-sm truncate flex-1 ${isSelected ? 'font-semibold' : ''}`}
                    title={doc.filename}
                >
                    {doc.filename}
                </span>

                {/* Hover X button for removable mode */}
                {removableMode && isHovered && onRemoveFromSelection && !isLoading && (
                    <button
                        onClick={handleRemoveClick}
                        className={`
                            ml-2 p-1 rounded-full transition-colors flex items-center justify-center bg-transparent
                            text-brand-grey-4 hover:bg-brand-red/10 hover:text-brand-red
                        `}
                        title="Remove from selection"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                )}

                {/* Status icon (hidden when showing X) */}
                {(!removableMode || !isHovered) && (
                    <span className="text-xs ml-2">
                        {getStatusIcon(doc.status)}
                    </span>
                )}
            </div>

            {/* Progress bar */}
            {showProgress && (
                <div className="mt-2 h-1 bg-brand-grey-7 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-brand-blue transition-all duration-300"
                        style={{ width: `${doc.progress}%` }}
                    />
                </div>
            )}

            {/* Error message */}
            {doc.status === DOC_STATUS.ERROR && doc.error && (
                <p className="mt-1 text-xs text-red-500 truncate" title={doc.error}>
                    {doc.error}
                </p>
            )}
        </li>
    );
}
