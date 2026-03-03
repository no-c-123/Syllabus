import { Layer, Rect, Transformer } from "react-konva";
import { useBlockStore } from "../blocks/useBlockStore";
import { useRef, useEffect } from "react";
import Konva from "konva";

export function LassoLayer({
  selectionBBox,
  stageScale,
  updateBlocks,
  updateStrokes,
  updateBlockSize,
  strokes,
  selectedIds,
  setSelectionOffset,
}: {
  selectionBBox: { x: number; y: number; width: number; height: number } | null;
  stageScale: number;
  updateBlocks: (updates: { id: string; x: number; y: number }[]) => Promise<void>;
  updateStrokes: (updates: { id: string; points: number[] }[]) => Promise<void>;
  updateBlockSize: (id: string, width: number, height: number) => void;
  strokes: any[];
  selectedIds: string[];
  setSelectedIds: (ids: string[]) => void;
  setSelectionOffset: (offset: { x: number; y: number }) => void;
}) {
  const isGestureRef = useRef(false);
  const trRef = useRef<Konva.Transformer>(null);
  const rectRef = useRef<Konva.Rect>(null);

  useEffect(() => {
    if (selectionBBox && trRef.current && rectRef.current) {
      // We must manually attach the transformer to the rect
      trRef.current.nodes([rectRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [selectionBBox]);

  if (!selectionBBox) return null;

  return (
    <Layer>
      <Rect
        ref={rectRef}
        x={selectionBBox.x}
        y={selectionBBox.y}
        width={selectionBBox.width}
        height={selectionBBox.height}
        stroke="#6366f1"
        strokeWidth={2 / stageScale}
        dash={[5 / stageScale, 5 / stageScale]}
        draggable
        onDragStart={() => {
          isGestureRef.current = true;
        }}
        onDragMove={(e) => {
          const dx = e.target.x() - selectionBBox.x;
          const dy = e.target.y() - selectionBBox.y;
          
          setSelectionOffset({ x: dx, y: dy });
          
          // Optimistically move blocks
          const blockUpdates = selectedIds
            .map(id => {
              const b = useBlockStore.getState().blocks.find(bl => bl.id === id);
              if (!b) return null;
              return { id, x: b.x + dx, y: b.y + dy };
            })
            .filter((u): u is { id: string; x: number; y: number } => u !== null);
          
          if (blockUpdates.length > 0) void updateBlocks(blockUpdates);
        }}
        onDragEnd={(e) => {
          isGestureRef.current = false;
          const dx = e.target.x() - selectionBBox.x;
          const dy = e.target.y() - selectionBBox.y;
          
          setSelectionOffset({ x: 0, y: 0 });

          const strokeUpdates = selectedIds
            .map(id => {
              const s = strokes.find(st => st.id === id);
              if (!s) return null;
              return {
                id,
                points: s.points.map((p: number, i: number) => i % 2 === 0 ? p + dx : p + dy)
              };
            })
            .filter((u): u is { id: string; points: number[] } => u !== null);
          
          if (strokeUpdates.length > 0) void updateStrokes(strokeUpdates);

          const blockUpdates = selectedIds
            .map(id => {
              const b = useBlockStore.getState().blocks.find(bl => bl.id === id);
              if (!b) return null;
              return { id, x: b.x + dx, y: b.y + dy };
            })
            .filter((u): u is { id: string; x: number; y: number } => u !== null);
          
          if (blockUpdates.length > 0) void updateBlocks(blockUpdates);
          
          e.target.position({ x: selectionBBox.x + dx, y: selectionBBox.y + dy });
        }}
        onTransformEnd={() => {
            const node = rectRef.current;
            if (!node) return;

            const scaleX = node.scaleX();
            const scaleY = node.scaleY();
            const x = node.x();
            const y = node.y();

            // Reset node scale/rotation to 1/0 so next transform starts clean
            // BUT we must update the rect's position/size to match what the transformer just did visually
            // actually, transformer updates the node's properties directly (scaleX, scaleY, rotation, x, y)
            
            // We need to apply these changes to our data model, then reset the node to match the new data model
            // The data model is:
            // Strokes: array of points
            // Blocks: x, y, width, height
            
            // The Rect currently represents the bounding box of the selection.
            // When we transform it, we are effectively saying "the new bounding box is this".
            
            // Calculate the new bounding box based on the transform
            const newRectX = x;
            const newRectY = y;
            const newRectWidth = selectionBBox.width * scaleX;
            const newRectHeight = selectionBBox.height * scaleY;
            
            // Reset node transforms immediately to prevent double application
            node.scaleX(1);
            node.scaleY(1);
            node.rotation(0);
            
            // Apply transformation to strokes
            const strokeUpdates = selectedIds
            .map(id => {
              const s = strokes.find(st => st.id === id);
              if (!s) return null;
              
              // We need to map points from old bbox to new bbox
              // Old normalized position: (p - oldX) / oldWidth
              // New position: newX + normalized * newWidth
              
              const newPoints = s.points.map((p: number, i: number) => {
                  if (i % 2 === 0) { // x
                      const normalized = (p - selectionBBox.x) / selectionBBox.width;
                      return newRectX + normalized * newRectWidth;
                  } else { // y
                      const normalized = (p - selectionBBox.y) / selectionBBox.height;
                      return newRectY + normalized * newRectHeight;
                  }
              });

              return { id, points: newPoints };
            })
            .filter((u): u is { id: string; points: number[] } => u !== null);

            if (strokeUpdates.length > 0) void updateStrokes(strokeUpdates);

            // Apply transformation to blocks
            const blockUpdates = selectedIds
            .map(id => {
                const b = useBlockStore.getState().blocks.find(bl => bl.id === id);
                if (!b) return null;
                
                // Old normalized position
                const normX = (b.x - selectionBBox.x) / selectionBBox.width;
                const normY = (b.y - selectionBBox.y) / selectionBBox.height;
                const normW = (b.width || 200) / selectionBBox.width;
                const normH = (b.height || 200) / selectionBBox.height;
                
                const newX = newRectX + normX * newRectWidth;
                const newY = newRectY + normY * newRectHeight;
                const newWidth = normW * newRectWidth;
                const newHeight = normH * newRectHeight;
                
                // Update size immediately
                updateBlockSize(id, newWidth, newHeight);
                
                return { id, x: newX, y: newY };
            })
            .filter((u): u is { id: string; x: number; y: number } => u !== null);
            
            if (blockUpdates.length > 0) void updateBlocks(blockUpdates);
            
            // We do NOT update the rect position manually here because the parent component
            // will re-calculate selectionBBox based on the new data and pass it down.
        }}
      />
      <Transformer
        ref={trRef}
        boundBoxFunc={(oldBox, newBox) => {
          if (newBox.width < 5 || newBox.height < 5) {
            return oldBox;
          }
          return newBox;
        }}
        rotateEnabled={false}
        enabledAnchors={[
          "top-left", "top-center", "top-right",
          "middle-right", "middle-left",
          "bottom-left", "bottom-center", "bottom-right",
        ]}
      />
    </Layer>
  );
}
