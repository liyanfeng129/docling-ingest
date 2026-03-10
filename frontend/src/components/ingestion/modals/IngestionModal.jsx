/**
 * IngestionModal Component
 * 
 * Modern modal for selecting target database and ingestion strategy.
 * Clicking "Preview Embeddings" closes the modal and shows preview in main content area.
 * 
 * Uses backendConfig.strategies from the backend API for dynamic strategy list.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'react-toastify';
import { createCollection } from '../../../services/ingestionApi';

/**
 * Icons mapped by strategy ID
 * Falls back to a default icon if no match
 */
const STRATEGY_ICONS = {
    embed_per_page: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
    ),
    chunked_fixed: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
    ),
    semantic_sections: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
    ),
    default: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
    ),
};

/**
 * Get icon for a strategy, falling back to default
 */
const getStrategyIcon = (strategyId) => {
    return STRATEGY_ICONS[strategyId] || STRATEGY_ICONS.default;
};

/**
 * Generate short description from features array or use type
 */
const getShortDesc = (strategy) => {
    if (strategy.features && strategy.features.length > 0) {
        return strategy.features[0];
    }
    return strategy.type === 'local' ? 'Local processing' : 'AI-powered';
};

export default function IngestionModal({
    isOpen,
    onClose,
    onShowPreview,
    onCollectionCreated,
    backendConfig,
    isIngesting = false,
    progress = 0,
    isDarkMode = false,
}) {
    const [selectedDb, setSelectedDb] = useState('');
    const [isCreatingNewDb, setIsCreatingNewDb] = useState(false);
    const [newDbName, setNewDbName] = useState('');
    const [isCreatingDb, setIsCreatingDb] = useState(false); // Loading state for DB creation
    const [selectedStrategy, setSelectedStrategy] = useState('');

    // Get strategies from backend config
    const strategies = useMemo(() => {
        return backendConfig?.strategies || [];
    }, [backendConfig]);

    // Reset selection when modal opens
    useEffect(() => {
        if (isOpen) {
            setSelectedDb('');
            setIsCreatingNewDb(false);
            setNewDbName('');
            setIsCreatingDb(false);
            // Set default to first enabled strategy
            const firstEnabled = strategies.find(s => s.enabled);
            setSelectedStrategy(firstEnabled?.id || '');
        }
    }, [isOpen, strategies]);

    // Close on escape
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isOpen && !isIngesting) {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, isIngesting, onClose]);

    const handleDbChange = (e) => {
        const value = e.target.value;
        if (value === '__create_new__') {
            setIsCreatingNewDb(true);
            setSelectedDb(''); // Reset selected DB ID
        } else {
            setSelectedDb(value);
        }
    };

    const handleCreateCollection = async () => {
        if (!newDbName.trim()) return;

        setIsCreatingDb(true);

        try {
            const result = await createCollection(newDbName.trim());

            if (result.success) {
                toast.success(`Collection "${result.collection?.name || newDbName}" created successfully`);

                // Set as selected and exit edit mode
                const createdName = result.collection?.name || newDbName.trim();
                setSelectedDb(createdName);
                setIsCreatingNewDb(false);
                setNewDbName('');

                // Refresh collections list to include the new collection
                if (onCollectionCreated) {
                    await onCollectionCreated();
                }
            } else {
                toast.error(result.error || 'Failed to create collection');
            }
        } catch (e) {
            console.error('Create collection error:', e);
            toast.error(e.message || 'Failed to create collection');
        } finally {
            setIsCreatingDb(false);
        }
    };

    const handleKeyDownCreate = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleCreateCollection();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            setIsCreatingNewDb(false);
            setNewDbName('');
        }
    };

    const availableDbs = backendConfig?.availableTargetDbs || [];
    const embeddingModels = backendConfig?.embeddingModels || [];

    // Handle showing preview in main content area
    const handleShowPreview = useCallback(() => {
        const targetDb = isCreatingNewDb ? newDbName.trim() : selectedDb;

        if (!targetDb) {
            toast.warning('Please select or create a collection first');
            return;
        }
        if (!selectedStrategy) {
            toast.warning('Please select an ingestion strategy');
            return;
        }

        onShowPreview(targetDb, selectedStrategy);
        onClose();
    }, [selectedDb, selectedStrategy, isCreatingNewDb, newDbName, onShowPreview, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" aria-labelledby="modal-title" role="dialog" aria-modal="true">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
                onClick={() => !isIngesting && onClose()}
            ></div>

            {/* Modal Panel */}
            <div className={`relative transform overflow-hidden rounded-2xl shadow-2xl transition-all flex flex-col max-h-[90vh] sm:w-full sm:max-w-2xl ${isDarkMode ? 'bg-[#2d2d2d]' : 'bg-white'}`}>

                {/* Header */}
                <div className="bg-gradient-to-r from-brand-blue to-brand-dark-blue px-6 py-4 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                        <div>
                            <h3 className="text-xl font-semibold text-white tracking-tight" id="modal-title">
                                Ingest Documents
                            </h3>
                            <p className="text-brand-blue-light-4 text-xs mt-0.5 opacity-90">
                                Process and store your documents for AI retrieval
                            </p>
                        </div>
                    </div>
                    {!isIngesting && (
                        <button
                            onClick={onClose}
                            className="rounded-full p-2 text-white/70 hover:bg-white/10 hover:text-white transition-colors focus:outline-none"
                        >
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>

                {/* Body */}
                <div className="px-6 py-6 overflow-y-auto">
                    {/* Configuration Step */}
                    <>
                        {/* Database Selection */}
                        <div className="mb-6">
                            <label className={`block text-sm font-semibold mb-2 ${isDarkMode ? 'text-[#b0b0b0]' : 'text-brand-grey-3'}`}>
                                Available Knowledge Base
                            </label>

                            {!isCreatingNewDb ? (
                                <div className="relative">
                                    <select
                                        value={selectedDb}
                                        onChange={handleDbChange}
                                        disabled={isIngesting}
                                        className={`block w-full appearance-none rounded-xl border px-4 py-3 pr-8 shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue sm:text-sm transition-all disabled:opacity-60 cursor-pointer
                                            ${isDarkMode 
                                                ? 'bg-[#404040] border-[#555] text-white hover:bg-[#4a4a4a]' 
                                                : 'bg-white border-brand-grey-7 text-brand-black hover:bg-brand-grey-9'
                                            }`}
                                    >
                                        <option value="">Select a destination collection...</option>
                                        <option value="__create_new__" className="font-bold text-brand-blue">
                                            + Create new collection...
                                        </option>
                                        <hr />
                                        {availableDbs.map((db) => (
                                            <option key={db.id} value={db.id}>
                                                {db.label}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4">
                                        <svg className={`h-4 w-4 ${isDarkMode ? 'text-[#888]' : 'text-brand-grey-4'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                                        </svg>
                                    </div>
                                </div>
                            ) : (
                                <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="relative flex items-center">
                                        <div className="absolute left-3 text-brand-blue">
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                            </svg>
                                        </div>
                                        <input
                                            type="text"
                                            value={newDbName}
                                            onChange={(e) => setNewDbName(e.target.value)}
                                            onKeyDown={handleKeyDownCreate}
                                            placeholder="Enter new collection name..."
                                            autoFocus
                                            disabled={isIngesting || isCreatingDb}
                                            className={`block w-full rounded-xl border border-brand-blue px-4 py-3 pl-10 pr-20 shadow-sm focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue sm:text-sm transition-all
                                                ${isDarkMode 
                                                    ? 'bg-[#404040] text-white placeholder:text-[#888]' 
                                                    : 'bg-white text-brand-black placeholder:text-brand-grey-4'
                                                }`}
                                        />
                                        <div className="absolute right-2 flex items-center gap-1">
                                            <button
                                                onClick={handleCreateCollection}
                                                disabled={!newDbName.trim() || isIngesting || isCreatingDb}
                                                className="p-1.5 text-brand-blue hover:text-white hover:bg-brand-blue rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                title="Create Collection"
                                            >
                                                {isCreatingDb ? (
                                                    <svg className="animate-spin w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                ) : (
                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                )}
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setIsCreatingNewDb(false);
                                                    setNewDbName('');
                                                }}
                                                disabled={isIngesting || isCreatingDb}
                                                className="p-1.5 text-brand-grey-4 hover:text-brand-red hover:bg-brand-red/10 rounded-lg transition-colors"
                                                title="Cancel"
                                            >
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                    <p className="text-xs text-brand-blue mt-1.5 ml-1 font-medium flex justify-between">
                                        <span>Creating specific collection for these documents</span>
                                        <span className={`font-normal ${isDarkMode ? 'text-[#888]' : 'text-brand-grey-4'}`}>Press Enter to create</span>
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Embedding Model Selection */}
                        {embeddingModels.length > 0 && (
                            <div className="mb-6">
                                <label className={`block text-sm font-semibold mb-2 flex justify-between ${isDarkMode ? 'text-[#b0b0b0]' : 'text-brand-grey-3'}`}>
                                    <span>Embedding Model</span>
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-[#404040] text-[#888]' : 'bg-brand-grey-8 text-brand-grey-4'}`}>Coming Soon</span>
                                </label>
                                <div className="relative">
                                    <select
                                        disabled
                                        className={`block w-full appearance-none rounded-xl border px-4 py-3 pr-8 shadow-sm cursor-not-allowed opacity-75
                                            ${isDarkMode ? 'bg-[#404040] border-[#555] text-[#888]' : 'bg-brand-grey-9 border-brand-grey-7 text-brand-grey-4'}`}
                                    >
                                        {embeddingModels.map((model) => (
                                            <option key={model.id} value={model.id} disabled={model.disabled}>
                                                {model.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}

                        {/* Strategy Selection */}
                        <div className="mb-2">
                            <label className={`block text-sm font-semibold mb-3 ${isDarkMode ? 'text-[#b0b0b0]' : 'text-brand-grey-3'}`}>
                                Ingestion Strategy
                            </label>
                            <div className="flex flex-col gap-3">
                                {strategies.map((strategy) => {
                                    const isSelected = selectedStrategy === strategy.id;
                                    const isDisabled = !strategy.enabled;
                                    return (
                                        <button
                                            key={strategy.id}
                                            onClick={() => !isIngesting && !isDisabled && setSelectedStrategy(strategy.id)}
                                            disabled={isIngesting || isDisabled}
                                            className={`group relative flex items-start text-left rounded-xl border p-4 transition-all duration-200 outline-none
                                            ${isSelected
                                                ? 'border-brand-blue bg-brand-blue-light-5 shadow-sm ring-1 ring-brand-blue'
                                                : isDisabled
                                                    ? `${isDarkMode ? 'border-[#404040] bg-[#333]' : 'border-brand-grey-7 bg-brand-grey-9'} opacity-60 cursor-not-allowed`
                                                    : isDarkMode
                                                        ? 'border-[#404040] bg-[#404040] hover:border-brand-blue/50 hover:bg-[#4a4a4a] hover:shadow-sm'
                                                        : 'border-brand-grey-7 bg-white hover:border-brand-blue/50 hover:bg-brand-grey-9 hover:shadow-sm'
                                            } ${isIngesting ? 'cursor-not-allowed opacity-70' : ''}`
                                        }
                                        >
                                            {/* Radio Indicator */}
                                            <div className="flex items-center justify-center shrink-0 mt-0.5 mr-4">
                                                <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors 
                                                ${isSelected
                                                        ? 'border-brand-blue bg-brand-blue'
                                                        : isDisabled
                                                            ? 'border-brand-grey-4 bg-brand-grey-8'
                                                            : 'border-brand-grey-4 group-hover:border-brand-blue/50'
                                                    }`}>
                                                    {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                                                </div>
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                    <h4 className={`font-bold text-sm ${isSelected ? 'text-brand-blue' : isDarkMode ? 'text-white' : 'text-brand-black'}`}>
                                                        {strategy.label}
                                                    </h4>

                                                    {isDisabled ? (
                                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-brand-grey-8 text-brand-grey-4 border border-brand-grey-7">
                                                            Coming Soon
                                                        </span>
                                                    ) : (
                                                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${isSelected ? 'bg-brand-blue/10 text-brand-blue' : 'bg-brand-grey-8 text-brand-grey-4'}`}>
                                                            {getShortDesc(strategy)}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className={`text-xs leading-relaxed ${isSelected ? 'text-brand-dark-blue' : isDarkMode ? 'text-[#b0b0b0]' : 'text-brand-grey-3'}`}>
                                                    {strategy.description}
                                                </p>
                                            </div>

                                            {/* Icon (Optional, can hide on small screens) */}
                                            <div className={`hidden sm:block ml-4 p-2 rounded-lg shrink-0 transition-colors 
                                                ${isSelected ? 'text-brand-blue bg-white' : 'text-brand-grey-4 bg-brand-grey-9'}
                                                ${!isDisabled && !isSelected && 'group-hover:text-brand-blue group-hover:bg-brand-blue-light-5'}
                                            `}>
                                                {getStrategyIcon(strategy.id)}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </>
                </div>

                {/* Footer */}
                <div className={`px-6 py-4 flex flex-col gap-4 border-t shrink-0 ${isDarkMode ? 'bg-[#333] border-[#404040]' : 'bg-brand-grey-9 border-brand-grey-8'}`}>
                    {isIngesting ? (
                        <div className="w-full py-2">
                            <div className="flex justify-between text-xs font-semibold text-brand-blue mb-2">
                                <span>Processing documents...</span>
                                <span>{progress}%</span>
                            </div>
                            <div className="h-2.5 w-full bg-brand-grey-7 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-brand-blue transition-all duration-500 ease-out flex items-center justify-end"
                                    style={{ width: `${Math.max(5, progress)}%` }}
                                >
                                    <div className={`h-full w-full bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)] bg-[length:1rem_1rem] animate-[spin_1s_linear_infinite]`} style={{ animation: 'progress-stripes 1s linear infinite' }} />
                                </div>
                            </div>
                            <style jsx>{`
                                @keyframes progress-stripes {
                                    from { background-position: 1rem 0; }
                                    to { background-position: 0 0; }
                                }
                            `}</style>
                        </div>
                    ) : (
                        /* Config step footer */
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={onClose}
                                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-brand-black bg-white border border-brand-grey-7 hover:bg-brand-grey-9 hover:border-brand-grey-4 transition-all shadow-sm"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleShowPreview}
                                disabled={(!selectedDb && (!isCreatingNewDb || !newDbName.trim())) || !selectedStrategy}
                                className="px-6 py-2.5 rounded-xl bg-brand-blue text-white text-sm font-semibold shadow-md shadow-brand-blue/20 hover:bg-brand-dark-blue hover:shadow-lg hover:shadow-brand-blue/30 transform active:scale-95 transition-all disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                Preview Embeddings
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
