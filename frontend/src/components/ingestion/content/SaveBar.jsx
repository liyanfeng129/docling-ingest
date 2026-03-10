/**
 * SaveBar Component
 * 
 * Floating bar with undo/redo buttons and ingest action.
 * Content is auto-saved, so no manual save button needed.
 */

/**
 * @param {Object} props
 * @param {boolean} props.canUndo - Whether undo is available
 * @param {boolean} props.canRedo - Whether redo is available
 * @param {Function} props.onUndo - Undo handler
 * @param {Function} props.onRedo - Redo handler
 * @param {Function} props.onIngest - Ingest handler
 * @param {boolean} props.canIngest - Whether ingestion is available
 * @param {boolean} props.isDarkMode - Dark mode flag
 */
export default function SaveBar({
    canUndo = false,
    canRedo = false,
    onUndo,
    onRedo,
    onIngest,
    canIngest = true,
    isDarkMode = false,
}) {
    return (
        <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2">
                {/* Undo/Redo */}
                <button
                    onClick={onUndo}
                    disabled={!canUndo}
                    className={`px-2 sm:px-3 py-1.5 text-sm transition-all disabled:opacity-40 font-bold border
                        ${isDarkMode 
                            ? 'bg-[#404040] border-brand-blue hover:bg-[#4a4a4a] text-brand-blue' 
                            : 'bg-white border-brand-blue hover:bg-brand-blue-light-5 text-brand-blue'
                        }`}
                    title="Undo (Ctrl+Z)"
                >
                    <span className="hidden sm:inline">↩️ </span><span className="sm:hidden">↩️</span><span className="hidden sm:inline">Undo</span>
                </button>
                <button
                    onClick={onRedo}
                    disabled={!canRedo}
                    className={`px-2 sm:px-3 py-1.5 text-sm transition-all disabled:opacity-40 font-bold border
                        ${isDarkMode 
                            ? 'bg-[#404040] border-brand-blue hover:bg-[#4a4a4a] text-brand-blue' 
                            : 'bg-white border-brand-blue hover:bg-brand-blue-light-5 text-brand-blue'
                        }`}
                    title="Redo (Ctrl+Shift+Z)"
                >
                    <span className="hidden sm:inline">↪️ </span><span className="sm:hidden">↪️</span><span className="hidden sm:inline">Redo</span>
                </button>
            </div>

            <div className="flex items-center gap-2">
                {/* Auto-save indicator */}
                <span className={`text-xs flex items-center ${isDarkMode ? 'text-[#b0b0b0]' : 'text-brand-grey-4'}`}>
                    <span className="w-2 h-2 bg-brand-green rounded-full mr-1" />
                    <span className="hidden sm:inline">Auto-saved</span>
                </span>

                {/* Ingest button */}
                <button
                    onClick={onIngest}
                    disabled={!canIngest}
                    className="px-3 sm:px-4 py-1.5 text-sm font-bold transition-all disabled:opacity-40
                        bg-brand-green hover:bg-brand-green text-white"
                >
                    <span className="hidden sm:inline">🚀 </span>Ingest
                </button>
            </div>
        </div>
    );
}
