"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Stage, Layer, Image as KonvaImage, Rect, Transformer } from "react-konva";
import Konva from "konva";

export type BBoxStatus = "original" | "modified" | "new" | "deleted";

export interface BBox {
  id: string;
  x: number; // original image pixel coords
  y: number;
  w: number;
  h: number;
  text: string;
  status: BBoxStatus;
  lastModified?: number;
}

interface BboxCanvasProps {
  imageUrl: string;
  bboxList: BBox[];
  selectedIds: string[];
  toolMode: "select" | "draw";
  onBboxChange: (bboxes: BBox[]) => void;
  onSelectChange: (ids: string[]) => void;
}

// Color scheme by status
const STATUS_COLORS: Record<BBoxStatus, string> = {
  original: "#3B82F6",   // blue
  modified: "#F97316",   // orange
  new: "#22C55E",        // green
  deleted: "transparent",
};

export default function BboxCanvas({
  imageUrl,
  bboxList,
  selectedIds,
  toolMode,
  onBboxChange,
  onSelectChange,
}: BboxCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const [stageSize, setStageSize] = useState({ w: 800, h: 600 });
  const [htmlImage, setHtmlImage] = useState<HTMLImageElement | null>(null);
  const [naturalSize, setNaturalSize] = useState({ w: 1, h: 1 });

  // Drawing state
  const isDrawing = useRef(false);
  const drawStart = useRef({ x: 0, y: 0 });
  const [draftRect, setDraftRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  // ── Load image ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!imageUrl) return;
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.src = imageUrl;
    img.onload = () => {
      setHtmlImage(img);
      setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
    };
  }, [imageUrl]);

  // ── Fit stage to container width ────────────────────────────────────────────
  useEffect(() => {
    const update = () => {
      if (!containerRef.current || naturalSize.w === 1) return;
      const w = containerRef.current.clientWidth;
      const h = Math.round(w * (naturalSize.h / naturalSize.w));
      setStageSize({ w, h });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [naturalSize]);

  // ── Attach Transformer to selected rects ────────────────────────────────────
  useEffect(() => {
    if (!trRef.current || !stageRef.current) return;
    if (toolMode !== "select" || selectedIds.length === 0) {
      trRef.current.nodes([]);
      return;
    }
    const nodes = selectedIds
      .map((id) => stageRef.current!.findOne(`#rect-${id}`))
      .filter(Boolean) as Konva.Node[];
    trRef.current.nodes(nodes);
  }, [selectedIds, toolMode, bboxList]);

  const scale = stageSize.w / naturalSize.w;

  // ── Convert display coords → original coords ─────────────────────────────
  const toOriginal = (val: number) => val / scale;

  // ── Visible bboxes only ──────────────────────────────────────────────────
  const visibleBboxes = bboxList.filter((b) => b.status !== "deleted");

  // ── Handle stage click (deselect / select) ───────────────────────────────
  const handleStageMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      // If clicked on empty area in select mode → deselect
      if (toolMode === "select" && e.target === e.target.getStage()) {
        onSelectChange([]);
        return;
      }

      // Draw mode: start drawing
      if (toolMode === "draw") {
        const pos = e.target.getStage()!.getPointerPosition()!;
        isDrawing.current = true;
        drawStart.current = { x: pos.x, y: pos.y };
        setDraftRect({ x: pos.x, y: pos.y, w: 0, h: 0 });
      }
    },
    [toolMode, onSelectChange]
  );

  const handleStageMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!isDrawing.current || toolMode !== "draw") return;
      const pos = e.target.getStage()!.getPointerPosition()!;
      setDraftRect({
        x: Math.min(pos.x, drawStart.current.x),
        y: Math.min(pos.y, drawStart.current.y),
        w: Math.abs(pos.x - drawStart.current.x),
        h: Math.abs(pos.y - drawStart.current.y),
      });
    },
    [toolMode]
  );

  const handleStageMouseUp = useCallback(() => {
    if (!isDrawing.current || toolMode !== "draw" || !draftRect) return;
    isDrawing.current = false;

    // Ignore tiny accidental clicks
    if (draftRect.w < 5 || draftRect.h < 5) {
      setDraftRect(null);
      return;
    }

    const newBbox: BBox = {
      id: `new-${Date.now()}`,
      x: toOriginal(draftRect.x),
      y: toOriginal(draftRect.y),
      w: toOriginal(draftRect.w),
      h: toOriginal(draftRect.h),
      text: "",
      status: "new",
      lastModified: Date.now(),
    };
    onBboxChange([...bboxList, newBbox]);
    onSelectChange([newBbox.id]);
    setDraftRect(null);
  }, [toolMode, draftRect, bboxList, onBboxChange, onSelectChange, scale]);

  // ── Handle bbox rect click (select / multi-select) ───────────────────────
  const lastClickedRectId = useRef<string | null>(null);

  const handleRectClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>, bboxId: string) => {
      e.cancelBubble = true;
      if (toolMode !== "select") return;
      lastClickedRectId.current = bboxId;
      
      if (e.evt.shiftKey) {
        // Multi-select
        if (selectedIds.includes(bboxId)) {
          onSelectChange(selectedIds.filter((id) => id !== bboxId));
        } else {
          onSelectChange([...selectedIds, bboxId]);
        }
      } else {
        onSelectChange([bboxId]);
      }
    },
    [toolMode, selectedIds, onSelectChange]
  );



  // ── Handle drag end (move) ────────────────────────────────────────────────
  const handleDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>, bboxId: string) => {
      const node = e.target;
      onBboxChange(
        bboxList.map((b) =>
          b.id === bboxId
            ? {
                ...b,
                x: toOriginal(node.x()),
                y: toOriginal(node.y()),
                status: "modified",
                lastModified: Date.now(),
              }
            : b
        )
      );
    },
    [bboxList, onBboxChange, scale]
  );

  // ── Handle transform end (resize) ─────────────────────────────────────────
  const handleTransformEnd = useCallback(
    (e: Konva.KonvaEventObject<Event>, bboxId: string) => {
      const node = e.target as Konva.Rect;
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();
      node.scaleX(1);
      node.scaleY(1);
      onBboxChange(
        bboxList.map((b) =>
          b.id === bboxId
            ? {
                ...b,
                x: toOriginal(node.x()),
                y: toOriginal(node.y()),
                w: toOriginal(node.width() * scaleX),
                h: toOriginal(node.height() * scaleY),
                status: "modified",
                lastModified: Date.now(),
              }
            : b
        )
      );
    },
    [bboxList, onBboxChange, scale]
  );

  return (
    <div ref={containerRef} className="w-full relative select-none" style={{ minHeight: 200 }}>
      <Stage
        ref={stageRef}
        width={stageSize.w}
        height={stageSize.h}
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
        style={{ cursor: toolMode === "draw" ? "crosshair" : "default" }}
      >
        {/* Layer 1: The document image */}
        <Layer>
          {htmlImage && (
            <KonvaImage
              image={htmlImage}
              x={0}
              y={0}
              width={stageSize.w}
              height={stageSize.h}
            />
          )}
        </Layer>

        {/* Layer 2: Bounding boxes */}
        <Layer>
          {visibleBboxes.map((b) => {
            const isSelected = selectedIds.includes(b.id);
            const color = STATUS_COLORS[b.status];
            return (
              <Rect
                key={b.id}
                id={`rect-${b.id}`}
                x={b.x * scale}
                y={b.y * scale}
                width={b.w * scale}
                height={b.h * scale}
                stroke={isSelected ? "#EAB308" : color}
                strokeWidth={isSelected ? 2.5 : 1.5}
                fill={isSelected ? "rgba(234, 179, 8, 0.2)" : "rgba(0,0,0,0)"}
                draggable={toolMode === "select"}
                onClick={(e) => handleRectClick(e, b.id)}
                onDragEnd={(e) => handleDragEnd(e, b.id)}
                onTransformEnd={(e) => handleTransformEnd(e, b.id)}
              />
            );
          })}

          {/* Draft rectangle while drawing */}
          {draftRect && (
            <Rect
              x={draftRect.x}
              y={draftRect.y}
              width={draftRect.w}
              height={draftRect.h}
              stroke="#22C55E"
              strokeWidth={2}
              fill="rgba(34,197,94,0.1)"
              dash={[6, 3]}
            />
          )}

          {/* Transformer for resize handles */}
          <Transformer
            ref={trRef}
            rotateEnabled={false}
            keepRatio={false}
            enabledAnchors={["top-left","top-center","top-right","middle-left","middle-right","bottom-left","bottom-center","bottom-right"]}
            boundBoxFunc={(oldBox, newBox) => {
              if (newBox.width < 10 || newBox.height < 10) return oldBox;
              return newBox;
            }}
          />
        </Layer>
      </Stage>
    </div>
  );
}
