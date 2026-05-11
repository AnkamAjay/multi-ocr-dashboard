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
    <div className="flex items-center gap-2 px-3 py-2 bg-gray-900 rounded-xl border border-gray-700 shadow-lg flex-wrap">

      {/* Mode toggle */}
      <div className="flex items-center bg-gray-800 rounded-lg p-0.5 gap-0.5">
        <button
          onClick={() => onModeChange("select")}
          title="Select / Move / Resize bounding boxes"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
            toolMode === "select"
              ? "bg-indigo-600 text-white shadow"
              : "text-gray-400 hover:text-white"
          }`}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
            <path d="M1 1l4.5 11 2-4.5L12 9.5 1 1z"/>
          </svg>
          Select
        </button>
        <button
          onClick={() => onModeChange("draw")}
          title="Draw a new bounding box by clicking and dragging"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
            toolMode === "draw"
              ? "bg-green-600 text-white shadow"
              : "text-gray-400 hover:text-white"
          }`}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="2" width="12" height="12" rx="1"/>
            <line x1="8" y1="5" x2="8" y2="11"/>
            <line x1="5" y1="8" x2="11" y2="8"/>
          </svg>
          Draw
        </button>
      </div>

      {/* Divider */}
      <div className="w-px h-6 bg-gray-700" />

      {/* Delete */}
      <button
        onClick={onDelete}
        disabled={!hasSelection}
        title={hasSelection ? "Delete selected bounding box(es)" : "Select a bbox first"}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
          hasSelection
            ? "bg-red-600 hover:bg-red-500 text-white active:scale-95"
            : "bg-gray-800 text-gray-600 cursor-not-allowed"
        }`}
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
          <path d="M6 2h4a1 1 0 0 1 1 1H5a1 1 0 0 1 1-1zM3 4h10l-1 9H4L3 4zm3 2v5h1V6H6zm2 0v5h1V6H8z"/>
        </svg>
        Delete
        {hasSelection && selectedIds.length > 1 && (
          <span className="bg-red-400 text-white text-[10px] px-1.5 py-0.5 rounded-full">
            {selectedIds.length}
          </span>
        )}
      </button>

      {/* Merge */}
      <button
        onClick={onMerge}
        disabled={!canMerge}
        title={canMerge ? "Merge selected bounding boxes into one" : "Select 2 or more bboxes to merge"}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
          canMerge
            ? "bg-amber-600 hover:bg-amber-500 text-white active:scale-95"
            : "bg-gray-800 text-gray-600 cursor-not-allowed"
        }`}
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="1" y="1" width="6" height="6" rx="0.5"/>
          <rect x="9" y="1" width="6" height="6" rx="0.5"/>
          <rect x="3" y="9" width="10" height="6" rx="0.5"/>
          <line x1="8" y1="7" x2="8" y2="9"/>
        </svg>
        Merge
        {canMerge && (
          <span className="bg-amber-400 text-white text-[10px] px-1.5 py-0.5 rounded-full">
            {selectedIds.length}
          </span>
        )}
      </button>

      {/* Undo */}
      <button
        onClick={onUndo}
        disabled={!canUndo}
        title={canUndo ? "Undo last action" : "Nothing to undo"}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
          canUndo
            ? "bg-gray-700 hover:bg-gray-600 text-white active:scale-95"
            : "bg-gray-800 text-gray-600 cursor-not-allowed"
        }`}
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
          <path d="M5.5 3L2 6.5 5.5 10V7.5c2.8 0 4.8.9 6.2 2.8-.5-3.5-2.8-5.8-6.2-6.3V3z"/>
        </svg>
        Undo
      </button>

      {/* Divider */}
      <div className="w-px h-6 bg-gray-700" />

      {/* Status info */}
      <div className="flex items-center gap-3 ml-auto text-xs text-gray-400">
        {hasSelection && (
          <span className="text-indigo-400 font-medium">
            {selectedIds.length} selected
          </span>
        )}
        <span>{bboxCount} regions</span>
      </div>

      {/* Legend */}
      <div className="hidden xl:flex items-center gap-2 text-[10px] text-gray-500">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-blue-500 inline-block" />Original</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-orange-500 inline-block" />Moved</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-green-500 inline-block" />New</span>
      </div>
    </div>
  );
}
