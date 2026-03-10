/**
 * HelperFileSelectModal Component
 * 
 * Popup modal for selecting which file(s) to apply a helper function to.
 * Supports multi-selection of files.
 * Includes a quick "Apply to Current File Only" option.
 */

import { useState, useEffect } from 'react';

/**
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether modal is open
 * @param {Function} props.onClose - Close handler
 * @param {Function} props.onConfirm - Confirm handler (selectedDocumentIds: string[])
 * @param {Array} props.files - Array of file objects { documentId, filename, status }
 * @param {Object} props.helper - Helper object { id, label, description, icon }
 * @param {string} props.currentDocumentId - Currently selected document ID
 * @param {string} props.currentFilename - Currently selected document filename
 * @param {boolean} props.isDarkMode - Whether the app is in dark mode
 */
export default function HelperFileSelectModal({
    isOpen,
    onClose,
    onConfirm,
    files = [],
    helper = null,
    currentDocumentId = null,
    isDarkMode = false,
}) {
    const [selectedIds, setSelectedIds] = useState(new Set());

    // Reset selection when modal opens - only select current file by default
    useEffect(() => {
        if (isOpen) {
            // Pre-select only the current file by default (if eligible)
            if (currentDocumentId && files.some(f => f.documentId === currentDocumentId && f.status === 'ready')) {
                setSelectedIds(new Set([currentDocumentId]));
            } else {
                setSelectedIds(new Set());
            }
        }
    }, [isOpen, files, currentDocumentId]);

    if (!isOpen) return null;

    const handleToggle = (documentId) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(documentId)) {
                next.delete(documentId);
            } else {
                next.add(documentId);
            }
            return next;
        });
    };

    const handleSelectAll = () => {
        const allIds = files.map(f => f.documentId).filter(Boolean);
        const allSelected = allIds.every(id => selectedIds.has(id));

        if (allSelected) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(allIds));
        }
    };

    const handleConfirm = () => {
        if (selectedIds.size > 0) {
            onConfirm(Array.from(selectedIds));
        }
    };

    const eligibleFiles = files.filter(f => f.documentId && f.status === 'ready');
    const allSelected = eligibleFiles.length > 0 &&
        eligibleFiles.every(f => selectedIds.has(f.documentId));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className={`relative rounded-xl shadow-2xl w-full max-w-md overflow-hidden ${isDarkMode ? 'bg-[#2d2d2d]' : 'bg-white'}`}>
                {/* Header */}
                <div className={`px-4 py-3 border-b ${isDarkMode ? 'bg-[#333] border-[#404040]' : 'bg-gradient-to-r from-brand-blue-light-5 to-brand-blue-light-4 border-brand-grey-7'}`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            {helper?.icon && (
                                <span className="text-2xl">{helper.icon}</span>
                            )}
                            <div>
                                <h3 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-brand-black'}`}>
                                    {helper?.label || 'Apply Helper'}
                                </h3>
                                <p className={`text-xs ${isDarkMode ? 'text-[#b0b0b0]' : 'text-brand-grey-4'}`}>
                                    Select files to apply this helper to
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className={`rounded-full p-1 transition-colors
                                ${isDarkMode 
                                    ? 'text-[#888] hover:text-red-400 hover:bg-red-400/10' 
                                    : 'text-brand-grey-4 hover:text-red-500 hover:bg-red-50'
                                }`}
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Description */}
                {helper?.description && (
                    <div className={`px-4 py-2 border-b ${isDarkMode ? 'bg-[#404040] border-[#555]' : 'bg-brand-grey-9 border-brand-grey-7'}`}>
                        <p className={`text-sm ${isDarkMode ? 'text-[#b0b0b0]' : 'text-brand-grey-3'}`}>{helper.description}</p>
                    </div>
                )}

                {/* File List */}
                <div className="px-4 py-3 max-h-64 overflow-y-auto">
                    {eligibleFiles.length === 0 ? (
                        <div className="text-center py-4">
                            <div className="text-3xl mb-2">📭</div>
                            <p className={`text-sm ${isDarkMode ? 'text-[#b0b0b0]' : 'text-brand-grey-4'}`}>No eligible files</p>
                            <p className={`text-xs mt-1 ${isDarkMode ? 'text-[#888]' : 'text-brand-grey-5'}`}>
                                Upload and process files first
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Select All Header */}
                            <div className={`flex items-center justify-between mb-3 pb-2 border-b ${isDarkMode ? 'border-[#404040]' : 'border-brand-grey-7'}`}>
                                <span className={`text-xs font-semibold uppercase tracking-wide ${isDarkMode ? 'text-[#b0b0b0]' : 'text-brand-grey-3'}`}>
                                    Files ({eligibleFiles.length})
                                </span>
                                <button
                                    onClick={handleSelectAll}
                                    className={`px-3 py-1 text-xs font-medium rounded-full transition-colors
                                        ${isDarkMode 
                                            ? 'bg-brand-blue/20 text-brand-blue hover:bg-brand-blue/30' 
                                            : 'bg-brand-blue-light-5 text-brand-blue hover:bg-brand-blue-light-3'
                                        }`}
                                >
                                    {allSelected ? 'Deselect All' : 'Select All'}
                                </button>
                            </div>

                            {/* File Items */}
                            <div className="space-y-2">
                                {eligibleFiles.map((file) => (
                                    <label
                                        key={file.documentId}
                                        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors
                                            ${selectedIds.has(file.documentId)
                                                ? 'bg-brand-blue-light-5 border border-brand-blue'
                                                : isDarkMode
                                                    ? 'bg-[#404040] border border-transparent hover:bg-[#4a4a4a]'
                                                    : 'bg-brand-grey-9 border border-transparent hover:bg-brand-grey-8'
                                            }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.has(file.documentId)}
                                            onChange={() => handleToggle(file.documentId)}
                                            className="w-4 h-4 rounded border-brand-grey-4 text-brand-blue 
                                                focus:ring-brand-blue focus:ring-1 cursor-pointer"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm truncate ${isDarkMode ? 'text-white' : 'text-brand-black'}`} title={file.filename}>
                                                {file.filename}
                                            </p>
                                        </div>
                                        <span className="text-lg" title="Ready">📋</span>
                                    </label>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className={`px-4 py-3 border-t flex justify-end gap-2 ${isDarkMode ? 'bg-[#333] border-[#404040]' : 'bg-brand-grey-9 border-brand-grey-7'}`}>
                    <button
                        onClick={onClose}
                        className={`px-4 py-2 text-sm font-medium border rounded-lg transition-colors
                            ${isDarkMode 
                                ? 'bg-[#404040] border-[#555] text-white hover:bg-[#4a4a4a]' 
                                : 'bg-white border-brand-grey-7 text-brand-grey-3 hover:bg-brand-grey-9'
                            }`}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={selectedIds.size === 0}
                        className="px-4 py-2 text-sm font-medium text-white bg-brand-blue 
                            rounded-lg hover:bg-brand-dark-blue transition-colors
                            disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Apply to {selectedIds.size} File{selectedIds.size !== 1 ? 's' : ''}
                    </button>
                </div>
            </div>
        </div>
    );
}
