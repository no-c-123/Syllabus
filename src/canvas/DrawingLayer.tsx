import { Layer, Group, Path } from "react-konva";
import type { Stroke } from "./useCanvasStore";
import { useMemo, useRef, useEffect, memo } from "react";
import Konva from "konva";
import { QuadTree } from "../lib/QuadTree";

const TILE_SIZE = 1024;

interface Viewport {
  x: number;
  y: number;
  width: number;
  height: number;
  zoom: number;
}

interface TileKey {
  x: number;
  y: number;
}

// Custom midpoint smoothing algorithm for standard SVG paths
// This replaces perfect-freehand to ensure true constant width
export function getSmoothSvgPath(points: number[]) {
  if (points.length < 4) return "";

  let d = `M ${points[0]} ${points[1]}`;

  for (let i = 2; i < points.length - 2; i += 2) {
    const x1 = points[i];
    const y1 = points[i + 1];
    const x2 = points[i + 2];
    const y2 = points[i + 3];

    // Midpoint formula for quadratic bezier
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;

    d += ` Q ${x1} ${y1} ${midX} ${midY}`;
  }
  
  // Connect the last point
  const lastX = points[points.length - 2];
  const lastY = points[points.length - 1];
  d += ` L ${lastX} ${lastY}`;

  return d;
}

export function getPathData(stroke: Stroke) {
  if (stroke.shapeType) {
      if (stroke.points.length < 2) return "";
      let d = `M ${stroke.points[0]} ${stroke.points[1]}`;
      for (let i = 2; i < stroke.points.length; i += 2) {
          d += ` L ${stroke.points[i]} ${stroke.points[i+1]}`;
      }
      if (stroke.shapeType !== "line" && stroke.points.length > 4) {
          d += " Z";
      }
      return d;
  }
  return getSmoothSvgPath(stroke.points);
}

export function DrawingLayer({
  strokes,
  currentStroke,
  selectedIds = [],
  selectionOffset = { x: 0, y: 0 },
  viewport,
}: {
  strokes: Stroke[];
  currentStroke: Stroke | null;
  selectedIds?: string[];
  selectionOffset?: { x: number; y: number };
  viewport?: Viewport;
}) {
  // Use useMemo for QuadTree to ensure it's synchronous with render
  const quadTree = useMemo(() => {
    // Large fixed bounds for infinite canvas
    const minX = -1000000;
    const minY = -1000000;
    const maxX = 1000000;
    const maxY = 1000000;

    const qt = new QuadTree<Stroke>({
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
    });

    for (const stroke of strokes) {
        if (stroke.points.length < 2) continue;
        
        let sMinX = Infinity, sMinY = Infinity, sMaxX = -Infinity, sMaxY = -Infinity;
        for (let i = 0; i < stroke.points.length; i += 2) {
            sMinX = Math.min(sMinX, stroke.points[i]);
            sMinY = Math.min(sMinY, stroke.points[i+1]);
            sMaxX = Math.max(sMaxX, stroke.points[i]);
            sMaxY = Math.max(sMaxY, stroke.points[i+1]);
        }

        qt.insert({
            x: sMinX,
            y: sMinY,
            width: sMaxX - sMinX,
            height: sMaxY - sMinY,
            data: stroke
        });
    }
    
    return qt;
  }, [strokes]);

  // Calculate visible tiles based on viewport
  const visibleTileKeys = useMemo(() => {
    if (!viewport) return [];
    
    const startX = Math.floor((-viewport.x / viewport.zoom) / TILE_SIZE);
    const startY = Math.floor((-viewport.y / viewport.zoom) / TILE_SIZE);
    const endX = Math.floor(((-viewport.x + viewport.width) / viewport.zoom) / TILE_SIZE);
    const endY = Math.floor(((-viewport.y + viewport.height) / viewport.zoom) / TILE_SIZE);

    const keys: TileKey[] = [];
    // Add buffer tiles
    for (let x = startX - 1; x <= endX + 1; x++) {
        for (let y = startY - 1; y <= endY + 1; y++) {
            keys.push({ x, y });
        }
    }
    return keys;
  }, [viewport?.x, viewport?.y, viewport?.width, viewport?.height, viewport?.zoom]);

  // Query strokes for each visible tile
  const renderedTiles = useMemo(() => {
    return visibleTileKeys.map(key => {
        const tileX = key.x * TILE_SIZE;
        const tileY = key.y * TILE_SIZE;
        
        const found = quadTree.query({
            x: tileX,
            y: tileY,
            width: TILE_SIZE,
            height: TILE_SIZE
        });

        // Deduplicate strokes that might cross tile boundaries if needed,
        // but here we just render them. React key handles uniqueness.
        // Filter out selected strokes from the frozen tiles
        const tileStrokes = found
            .map(item => item.data)
            .filter(stroke => !selectedIds.includes(stroke.id));
        
        return (
            <Tile 
                key={`${key.x},${key.y}`}
                x={tileX}
                y={tileY}
                strokes={tileStrokes}
            />
        );
    });
  }, [visibleTileKeys, quadTree, selectedIds]); 

  // Render selected strokes separately (live, not cached)
  const selectedStrokesLayer = useMemo(() => {
    if (selectedIds.length === 0) return null;
    
    // Find the actual stroke objects for the selected IDs
    const selectedStrokes = strokes.filter(s => selectedIds.includes(s.id));
    
    return (
        <Group x={selectionOffset.x} y={selectionOffset.y}>
            {selectedStrokes.map(stroke => {
                const pathData = getPathData(stroke);
                return (
                  <Path
                    key={stroke.id}
                    data={pathData}
                    stroke={stroke.color}
                    strokeWidth={stroke.width}
                    lineCap="round"
                    lineJoin="round"
                    // Add a subtle shadow or effect to indicate selection if desired
                    shadowColor="rgba(99, 102, 241, 0.5)"
                    shadowBlur={5}
                    perfectDrawEnabled={false}
                    listening={false}
                  />
                );
            })}
        </Group>
    );
  }, [selectedIds, strokes, selectionOffset]);

  // Current stroke path generation
  const currentStrokePath = useMemo(() => {
    if (!currentStroke) return null;
    const pathData = getPathData(currentStroke);
    
    // Check if it's a lasso stroke (based on ID or some property we set)
    const isLasso = currentStroke.id === "lasso-current";

    if (isLasso) {
        return (
          <Path
            data={pathData}
            stroke="#6366f1" // Indigo-500
            strokeWidth={2 / viewport!.zoom} // Scale invariant width
            dash={[5 / viewport!.zoom, 5 / viewport!.zoom]} // Scale invariant dash
            lineCap="round"
            lineJoin="round"
            perfectDrawEnabled={false}
            listening={false}
          />
        );
    }

    return (
      <Path
        data={pathData}
        stroke={currentStroke.color}
        strokeWidth={currentStroke.width}
        lineCap="round"
        lineJoin="round"
        perfectDrawEnabled={false}
        listening={false}
      />
    );
  }, [currentStroke, viewport?.zoom]);

  return (
    <Layer listening={false}>
      {renderedTiles}
      {selectedStrokesLayer}
      {currentStrokePath}
    </Layer>
  );
}

// Separate component for each tile to handle its own caching
const Tile = memo(function Tile({ x, y, strokes }: { x: number, y: number, strokes: Stroke[] }) {
    const groupRef = useRef<Konva.Group>(null);

    const paths = useMemo(() => {
        return strokes.map(stroke => {
            const pathData = getPathData(stroke);
            return (
              <Path
                key={stroke.id}
                data={pathData}
                stroke={stroke.color}
                strokeWidth={stroke.width}
                lineCap="round"
                lineJoin="round"
                perfectDrawEnabled={false}
                listening={false}
              />
            );
        });
    }, [strokes]);

    useEffect(() => {
        if (groupRef.current) {
            // Add padding to cache area to prevent clipping strokes at tile boundaries
            const padding = 100;
            groupRef.current.cache({
                x: x - padding,
                y: y - padding,
                width: TILE_SIZE + (padding * 2),
                height: TILE_SIZE + (padding * 2),
            });
        }
    }, [paths, x, y]);

    if (strokes.length === 0) return null;

    return (
        <Group 
            ref={groupRef} 
            listening={false}
        >
            {paths}
        </Group>
    );
});
