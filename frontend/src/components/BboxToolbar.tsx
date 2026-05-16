"use client";

import { BBox } from "./BboxCanvas";

interface BboxToolbarProps {
  toolMode: "select" | "draw";
  selectedIds: string[];
  bboxCount: number;
  onModeChange: (mode: "select" | "draw") => void;
  onDelete: () => void;
  onMerge: () => void;
  onUndo: () => void;
  canUndo: boolean;
}

export default function BboxToolbar({
  toolMode,
  selectedIds,
  bboxCount,
  onModeChange,
  onDelete,
  onMerge,
  onUndo,
  canUndo,
}: BboxToolbarProps) {
  const hasSelection = selectedIds.length > 0;
  const canMerge = selectedIds.length >= 2;

  return (
    <div className="flex items-center gap-4 px-5 py-3.5 bg-gradient-to-r from-blue-50/80 via-white/90 to-indigo-50/80 backdrop-blur-md rounded-2xl border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.06)] flex-wrap transition-all duration-300">

      {/* Mode toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onModeChange("select")}
          title="Select / Move / Resize bounding boxes"
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 cursor-pointer ${
            toolMode === "select"
              ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md shadow-indigo-500/20 border border-transparent scale-[1.02]"
              : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 hover:-translate-y-0.5 hover:scale-[1.02] hover:shadow-sm"
          }`}
        >
          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
            <path d="M1 1l4.5 11 2-4.5L12 9.5 1 1z"/>
          </svg>
          Select
          <span className={`px-1.5 py-0.5 ml-1 text-[10px] font-bold rounded border tracking-wide ${
            toolMode === "select" ? "bg-white/20 text-white border-white/20" : "bg-gray-100 text-gray-400 border-gray-200"
          }`}>
            [V]
          </span>
        </button>

        <button
          onClick={() => onModeChange("draw")}
          title="Draw a new bounding box by clicking and dragging"
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 cursor-pointer ${
            toolMode === "draw"
              ? "bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-md shadow-blue-500/20 border border-transparent scale-[1.02]"
              : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 hover:-translate-y-0.5 hover:scale-[1.02] hover:shadow-sm"
          }`}
        >
          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="2" width="12" height="12" rx="1"/>
            <line x1="8" y1="5" x2="8" y2="11"/>
            <line x1="5" y1="8" x2="11" y2="8"/>
          </svg>
          Draw
          <span className={`px-1.5 py-0.5 ml-1 text-[10px] font-bold rounded border tracking-wide ${
            toolMode === "draw" ? "bg-white/20 text-white border-white/20" : "bg-gray-100 text-gray-400 border-gray-200"
          }`}>
            [D]
          </span>
        </button>
      </div>

      {/* Divider */}
      <div className="w-px h-8 bg-gray-200 mx-2 rounded-full" />

      {/* Delete */}
      <button
        onClick={onDelete}
        disabled={!hasSelection}
        title={hasSelection ? "Delete selected bounding box(es)" : "Select a bbox first"}
        className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 ${
          hasSelection
            ? "bg-white text-red-500 border border-red-100 hover:bg-red-50 hover:border-red-200 hover:-translate-y-0.5 hover:scale-[1.02] hover:shadow-sm cursor-pointer"
            : "bg-white/50 text-gray-400 border border-gray-100 cursor-not-allowed opacity-60"
        }`}
      >
        <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
          <path d="M6 2h4a1 1 0 0 1 1 1H5a1 1 0 0 1 1-1zM3 4h10l-1 9H4L3 4zm3 2v5h1V6H6zm2 0v5h1V6H8z"/>
        </svg>
        Delete
        <span className={`px-1.5 py-0.5 ml-1 text-[10px] font-bold rounded border tracking-wide ${
          hasSelection ? "bg-red-50 text-red-400 border-red-100" : "bg-gray-50 text-gray-300 border-gray-200"
        }`}>
          [Del]
        </span>
        {hasSelection && selectedIds.length > 1 && (
          <span className="bg-red-100 text-red-600 border border-red-200 text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-1">
            {selectedIds.length}
          </span>
        )}
      </button>

      {/* Merge */}
      <button
        onClick={onMerge}
        disabled={!canMerge}
        title={canMerge ? "Merge selected bounding boxes into one" : "Select 2 or more bboxes to merge"}
        className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 ${
          canMerge
            ? "bg-white text-amber-500 border border-amber-100 hover:bg-amber-50 hover:border-amber-200 hover:-translate-y-0.5 hover:scale-[1.02] hover:shadow-sm cursor-pointer"
            : "bg-white/50 text-gray-400 border border-gray-100 cursor-not-allowed opacity-60"
        }`}
      >
        <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="1" y="1" width="6" height="6" rx="0.5"/>
          <rect x="9" y="1" width="6" height="6" rx="0.5"/>
          <rect x="3" y="9" width="10" height="6" rx="0.5"/>
          <line x1="8" y1="7" x2="8" y2="9"/>
        </svg>
        Merge
        <span className={`px-1.5 py-0.5 ml-1 text-[10px] font-bold rounded border tracking-wide ${
          canMerge ? "bg-amber-50 text-amber-400 border-amber-100" : "bg-gray-50 text-gray-300 border-gray-200"
        }`}>
          [M]
        </span>
        {canMerge && (
          <span className="bg-amber-100 text-amber-600 border border-amber-200 text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-1">
            {selectedIds.length}
          </span>
        )}
      </button>

      {/* Undo */}
      <button
        onClick={onUndo}
        disabled={!canUndo}
        title={canUndo ? "Undo last action" : "Nothing to undo"}
        className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 ${
          canUndo
            ? "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 hover:border-gray-300 hover:-translate-y-0.5 hover:scale-[1.02] hover:shadow-sm cursor-pointer"
            : "bg-white/50 text-gray-400 border border-gray-100 cursor-not-allowed opacity-60"
        }`}
      >
        <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
          <path d="M5.5 3L2 6.5 5.5 10V7.5c2.8 0 4.8.9 6.2 2.8-.5-3.5-2.8-5.8-6.2-6.3V3z"/>
        </svg>
        Undo
        <span className={`px-1.5 py-0.5 ml-1 text-[10px] font-bold rounded border tracking-wide ${
          canUndo ? "bg-gray-100 text-gray-500 border-gray-200" : "bg-gray-50 text-gray-300 border-gray-200"
        }`}>
          [Ctrl+Z]
        </span>
      </button>

      {/* Divider */}
      <div className="w-px h-8 bg-gray-200 mx-2 rounded-full" />

      {/* Status info */}
      <div className="flex items-center gap-2 ml-auto">
        {hasSelection && (
          <div className="flex items-center px-3 py-1.5 bg-indigo-50/80 text-indigo-600 border border-indigo-100/50 rounded-full text-xs font-semibold shadow-sm backdrop-blur-sm transition-all">
            {selectedIds.length} selected
          </div>
        )}
        <div className="flex items-center px-3 py-1.5 bg-white/80 text-gray-600 border border-gray-200/50 rounded-full text-xs font-semibold shadow-sm backdrop-blur-sm transition-all">
          {bboxCount} regions
        </div>
      </div>

      {/* Legend */}
      <div className="hidden xl:flex items-center gap-3 px-3 py-1.5 bg-white/80 rounded-full border border-gray-200/50 shadow-sm backdrop-blur-sm text-[11px] font-semibold text-gray-500">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-400 shadow-sm shadow-blue-400/40" />Original</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-orange-400 shadow-sm shadow-orange-400/40" />Moved</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-400 shadow-sm shadow-green-400/40" />New</span>
      </div>
    </div>
  );
}
