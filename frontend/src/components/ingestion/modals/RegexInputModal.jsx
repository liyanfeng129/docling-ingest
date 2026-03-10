/**
 * RegexInputModal Component
 * 
 * Modal for inputting regex pattern for the "Delete by Regex" helper.
 */

import { useState, useEffect, useRef } from 'react';

/**
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether modal is open
 * @param {Function} props.onClose - Close handler
 * @param {Function} props.onConfirm - Confirm handler (pattern)
 * @param {boolean} props.isDarkMode - Whether the app is in dark mode
 */
export default function RegexInputModal({
    isOpen,
    onClose,
    onConfirm,
    isDarkMode = false,
}) {
    const [pattern, setPattern] = useState('');
    const [error, setError] = useState('');
    const inputRef = useRef(null);

    // Reset and focus when modal opens
    useEffect(() => {
        if (isOpen) {
            setPattern('');
            setError('');
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    // Close on escape
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // Validate and confirm
    const handleConfirm = () => {
        if (!pattern.trim()) {
            setError('Please enter a pattern');
            return;
        }

        // Validate regex
        try {
            new RegExp(pattern);
            onConfirm(pattern);
            onClose();
        } catch {
            setError('Invalid regular expression');
        }
    };

    // Handle enter key
    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleConfirm();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div
                className={`rounded-2xl shadow-xl p-6 w-96 max-w-[90vw] relative ${isDarkMode ? 'bg-[#2d2d2d]' : 'bg-white'}`}
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    className={`absolute top-4 right-4 rounded-full p-1 transition-colors
                        ${isDarkMode 
                            ? 'text-[#888] hover:text-red-400 hover:bg-red-400/10' 
                            : 'text-brand-grey-4 hover:text-red-500 hover:bg-red-50'
                        }`}
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                <h2 className={`text-lg font-bold mb-4 pr-8 ${isDarkMode ? 'text-white' : 'text-brand-grey-1'}`}>
                    Delete by Regex
                </h2>

                <p className={`text-sm mb-4 ${isDarkMode ? 'text-[#b0b0b0]' : 'text-brand-grey-4'}`}>
                    Enter a regular expression pattern. All text items matching this pattern will be marked as deleted.
                </p>

                <div className="mb-4">
                    <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-white' : 'text-brand-grey-1'}`}>
                        Pattern
                    </label>
                    <input
                        ref={inputRef}
                        type="text"
                        value={pattern}
                        onChange={(e) => {
                            setPattern(e.target.value);
                            setError('');
                        }}
                        onKeyDown={handleKeyDown}
                        placeholder="e.g., ^Chapter \d+$"
                        className={`w-full rounded-xl border px-3 py-2 outline-none transition font-mono text-sm focus:ring-2 focus:ring-brand-blue-light
                            ${isDarkMode 
                                ? 'bg-[#404040] text-white border-[#555] focus:border-brand-blue' 
                                : 'bg-white text-brand-grey-1 border-brand-grey-7 focus:border-brand-blue'
                            }
                            ${error ? 'border-red-500' : ''}`}
                    />
                    {error && (
                        <p className="text-xs text-red-500 mt-1">{error}</p>
                    )}
                </div>

                <div className={`mb-4 p-3 border rounded-lg ${isDarkMode ? 'bg-brand-blue/10 border-brand-blue/30' : 'bg-brand-blue-light-4 border-brand-blue-light-2'}`}>
                    <p className={`text-xs ${isDarkMode ? 'text-[#b0b0b0]' : 'text-brand-grey-2'}`}>
                        💡 Examples:
                        <br />• <code className={`px-1 rounded ${isDarkMode ? 'bg-[#404040]' : 'bg-white'}`}>^Page \d+$</code> - Lines starting with "Page" followed by numbers
                        <br />• <code className={`px-1 rounded ${isDarkMode ? 'bg-[#404040]' : 'bg-white'}`}>TODO</code> - Lines containing "TODO"
                        <br />• <code className={`px-1 rounded ${isDarkMode ? 'bg-[#404040]' : 'bg-white'}`}>^\s*$</code> - Empty or whitespace-only lines
                    </p>
                </div>

                {/* Buttons */}
                <div className="flex space-x-3">
                    <button
                        onClick={onClose}
                        className={`flex-1 px-4 py-2 rounded-xl border transition-all
                            ${isDarkMode 
                                ? 'bg-[#404040] border-[#555] text-white hover:bg-[#4a4a4a]' 
                                : 'bg-white border-brand-grey-7 text-brand-grey-1 hover:bg-brand-grey-8'
                            }`}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!pattern.trim()}
                        className="flex-1 px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white
                            transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        Delete Matches
                    </button>
                </div>
            </div>
        </div>
    );
}
