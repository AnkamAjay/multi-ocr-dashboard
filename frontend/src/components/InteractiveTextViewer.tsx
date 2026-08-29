"use client";

import React, { useMemo } from "react";
import { BBox } from "./BboxCanvas";

interface InteractiveTextViewerProps {
  bboxList: BBox[];
  selectedIds: string[];
  onSelectChange: (ids: string[]) => void;
}

export default function InteractiveTextViewer({
  bboxList,
  selectedIds,
  onSelectChange,
}: InteractiveTextViewerProps) {

  // Only valid (not deleted) bboxes should be shown
  const validBboxes = useMemo(() => {
    return bboxList.filter((b) => b.status !== "deleted");
  }, [bboxList]);

  // Sort BBoxes into reading order (lines)
  const lines = useMemo(() => {
    const sortedLines: BBox[][] = [];
    const sortedByY = [...validBboxes].sort((a, b) => a.y - b.y);

    sortedByY.forEach((box) => {
      let placed = false;
      if (sortedLines.length > 0) {
        const currentLine = sortedLines[sortedLines.length - 1];
        const referenceY = currentLine[0].y;
        const referenceH = currentLine[0].h;
        // Group into lines based on Y proximity
        if (Math.abs(box.y - referenceY) < Math.max(15, referenceH * 0.6)) {
          currentLine.push(box);
          placed = true;
        }
      }
      if (!placed) {
        sortedLines.push([box]);
      }
    });

    // Sort each line horizontally by X coordinate
    return sortedLines.map((line) => line.sort((a, b) => a.x - b.x));
  }, [validBboxes]);



  // Clicking an empty area clears the selection
  const handleContainerClick = () => {
    onSelectChange([]);
  };

  if (validBboxes.length === 0) {
    return (
      <div className="w-full flex-1 bg-gray-50 text-gray-400 border border-gray-200 p-4 rounded-lg italic flex items-center justify-center min-h-[250px]">
        No text available...
      </div>
    );
  }

  return (
    <div
      className="w-full flex-1 bg-gray-50 text-gray-700 border border-gray-200 p-4 rounded-lg overflow-y-auto focus:outline-none min-h-[250px] lg:max-h-[60vh] text-base leading-relaxed"
      onClick={handleContainerClick}
    >
      {lines.map((line, lineIdx) => (
        <div key={`line-${lineIdx}`} className="mb-4 flex flex-wrap gap-1">
          {line.map((b) => {
            const isSelected = selectedIds.includes(b.id);
            return (
              <span
                key={b.id}
                onClick={(e) => {
                  e.stopPropagation(); // Prevent container click from clearing selection
                  onSelectChange([b.id]);
                }}
                className={`cursor-pointer px-1 rounded transition-colors ${
                  isSelected
                    ? "bg-yellow-200 outline outline-2 outline-yellow-400 text-black font-medium"
                    : "hover:bg-gray-200"
                }`}
              >
                {b.text}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}
