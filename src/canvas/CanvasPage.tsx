import { useEffect, useMemo, useRef, useState, useCallback, type ReactNode } from "react";
import { Stage } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { Minus, Plus } from "lucide-react";
import { nanoid } from "nanoid";
import { useShapeSnapping } from "../hooks/useShapeSnapping";
import type { RecognizedShape } from "../lib/ShapeRecognizer";
import { isStrokeInPolygon, isRectInPolygon } from "../lib/selection";
import { useCanvasStore } from "./useCanvasStore";
import { useBlockStore } from "../blocks/useBlockStore";
import { useHistoryStore } from "../history/useHistoryStore";
import { useAppStore } from "../store/useAppStore";
import { DrawingLayer } from "./DrawingLayer";
import { GridLayer } from "./GridLayer";
import { ImageLayer } from "./ImageLayer";
import { useImagePaste } from "../hooks/useImagePaste";
import { ImageSelectionOverlay } from "../components/ImageSelectionOverlay";
import { LassoActionsOverlay } from "../components/LassoActionsOverlay";
import { LassoLayer } from "./LassoLayer";
import Konva from "konva";

const ZOOM_MIN = 0.1;
const ZOOM_MAX = 10;
const ZOOM_ANIMATION_MS = 200;

export default function CanvasPage({
  children,
  onDoubleClickPage,
}: {
  children?: ReactNode;
  onDoubleClickPage?: (pageId: string, x: number, y: number) => void;
}) {
  const activePageId = useAppStore((s) => s.activePageId);
  const selectBlock = useBlockStore((s) => s.selectBlock);
  const updateBlocks = useBlockStore((s) => s.updateBlocks);
  const updateBlockSize = useBlockStore((s) => s.updateBlockSize);
  const historyPush = useHistoryStore((s) => s.push);
  const {
    strokes,
    tool,
    strokeWidth,
    color,
    hydrateStrokesForPage,
    eraseAtPoint,
    selectedIds,
    setSelectedIds,
    selectionFilter,
    updateStrokes,
  } = useCanvasStore();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const pointerDownTimeRef = useRef<number>(0);
  const viewAnimationTimeoutRef = useRef<number | null>(null);
  const isPointerDownRef = useRef(false);
  const isErasingRef = useRef(false);
  const isGestureRef = useRef(false);
  const lastGestureCenterRef = useRef<{ x: number; y: number } | null>(null);
  const lastGestureDistanceRef = useRef<number | null>(null);
  const [tempStroke, setTempStroke] = useState<any | null>(null);
  const tempStrokeRef = useRef<any | null>(null);
  const tempPointsRef = useRef<number[]>([]);
  const [stageSize, setStageSize] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));
  const [view, setView] = useState(() => ({
     zoom: 1,
     position: { x: 0, y: 0 },
     animate: false,
   }));
   
   const [selectionOffset, setSelectionOffset] = useState({ x: 0, y: 0 });

   // Use the new image paste hook
   useImagePaste(stageSize, view);

    const onSnapShape = useCallback((shape: RecognizedShape) => {
        const shapePoints = shape.points.flatMap(p => [p.x, p.y]);
        
        // Update temp stroke to show the snapped shape
        setTempStroke((prev: any) => {
            if (!prev) return null;
            return {
                ...prev,
                points: shapePoints,
                shapeType: shape.type
            };
        });
    }, []);

    const onCancelSnap = useCallback(() => {
        // Revert to raw points if user continues drawing
        const rawPoints = tempPointsRef.current;
        setTempStroke((prev: any) => {
            if (!prev) return null;
            const { shapeType, ...rest } = prev;
            return {
                ...rest,
                points: [...rawPoints]
            };
        });
    }, []);

    const snapHook = useShapeSnapping({
        onSnap: onSnapShape,
        onCancel: onCancelSnap,
        enabled: useCanvasStore((s) => s.shapeRecognitionEnabled)
    });

   const getSelectionBBox = () => {
    if (selectedIds.length === 0) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    // Check strokes
    for (const id of selectedIds) {
      const s = strokes.find(st => st.id === id);
      if (s) {
        for (let i = 0; i < s.points.length; i += 2) {
          minX = Math.min(minX, s.points[i]);
          minY = Math.min(minY, s.points[i+1]);
          maxX = Math.max(maxX, s.points[i]);
          maxY = Math.max(maxY, s.points[i+1]);
        }
      }
    }
    
    // Check blocks
    const blocks = useBlockStore.getState().blocks;
    for (const id of selectedIds) {
      const b = blocks.find(bl => bl.id === id);
      if (b) {
        minX = Math.min(minX, b.x);
        minY = Math.min(minY, b.y);
        maxX = Math.max(maxX, b.x + (b.width || 400));
        maxY = Math.max(maxY, b.y + 24);
      }
    }
    
    if (minX === Infinity) return null;
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  };

  const selectionBBox = getSelectionBBox();

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new ResizeObserver(() => {
      const nextWidth = element.clientWidth;
      const nextHeight = element.clientHeight;
      if (nextWidth <= 0 || nextHeight <= 0) return;
      
      const nextStageSize = {
        width: nextWidth,
        height: nextHeight,
      };
      setStageSize(nextStageSize);
      setView((prev) => ({
        ...prev,
        position: constrainPosition(prev.position, prev.zoom, nextStageSize),
      }));
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    return () => {
      if (viewAnimationTimeoutRef.current) {
        window.clearTimeout(viewAnimationTimeoutRef.current);
        viewAnimationTimeoutRef.current = null;
      }
    };
  }, []);

  const baseScale = 1;
  const stageScale = view.zoom;

  const pageStrokes = useMemo(
    () => (activePageId ? strokes.filter((stroke) => stroke.pageId === activePageId) : []),
    [strokes, activePageId],
  );

  const pageCurrentStroke = tempStroke;

  useEffect(() => {
    if (!activePageId) return;
    void hydrateStrokesForPage(activePageId);
  }, [activePageId, hydrateStrokesForPage]);

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      if (target.isContentEditable) return true;
      const tag = target.tagName.toLowerCase();
      return tag === "input" || tag === "textarea" || tag === "select";
    };

    const clampLocal = (value: number, min: number, max: number) =>
      Math.max(min, Math.min(max, value));

    const zoomAtLocal = (
      anchor: { x: number; y: number },
      nextZoom: number,
      prev: { zoom: number; position: { x: number; y: number } },
    ) => {
      const nextClampedZoom = clampLocal(nextZoom, ZOOM_MIN, ZOOM_MAX);
      const prevScale = baseScale * prev.zoom;
      const nextScale = baseScale * nextClampedZoom;
      const worldX = (anchor.x - prev.position.x) / prevScale;
      const worldY = (anchor.y - prev.position.y) / prevScale;
      const nextPosition = {
        x: anchor.x - worldX * nextScale,
        y: anchor.y - worldY * nextScale,
      };
      return {
        zoom: nextClampedZoom,
        position: constrainPosition(nextPosition, nextClampedZoom, stageSize),
      };
    };

    const setAnimatedViewLocal = (
      updater: (prev: { zoom: number; position: { x: number; y: number }; animate: boolean }) => {
        zoom: number;
        position: { x: number; y: number };
        animate: boolean;
      },
    ) => {
      setView((prev) => {
        const next = updater(prev);
        return { ...next, animate: true };
      });
      if (viewAnimationTimeoutRef.current) {
        window.clearTimeout(viewAnimationTimeoutRef.current);
      }
      viewAnimationTimeoutRef.current = window.setTimeout(() => {
        setView((prev) => ({ ...prev, animate: false }));
        viewAnimationTimeoutRef.current = null;
      }, ZOOM_ANIMATION_MS);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      if (!(e.metaKey || e.ctrlKey)) return;

      const key = e.key;
      if (key === "+" || key === "=") {
        e.preventDefault();
        const anchor = { x: stageSize.width / 2, y: stageSize.height / 2 };
        setAnimatedViewLocal((prev) => {
          const next = zoomAtLocal(anchor, prev.zoom * 1.1, prev);
          return { ...prev, ...next };
        });
      }
      if (key === "-" || key === "_") {
        e.preventDefault();
        const anchor = { x: stageSize.width / 2, y: stageSize.height / 2 };
        setAnimatedViewLocal((prev) => {
          const next = zoomAtLocal(anchor, prev.zoom / 1.1, prev);
          return { ...prev, ...next };
        });
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [stageSize, baseScale]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    if (tool === "pen" || tool === "eraser" || tool === "lasso") {
      viewport.style.cursor = "crosshair";
    } else if (tool === "text") {
      viewport.style.cursor = "text";
    } else {
      viewport.style.cursor = "default";
    }
  }, [tool]);

  if (!activePageId) return null;

  const clamp = (value: number, min: number, max: number) =>
    Math.max(min, Math.min(max, value));

  const getContainerPoint = (evt: { clientX: number; clientY: number }) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
  };

  const getStagePoint = (containerPoint: { x: number; y: number }, zoom: number, position: { x: number; y: number }) => {
    const scale = baseScale * zoom;
    return {
      x: (containerPoint.x - position.x) / scale,
      y: (containerPoint.y - position.y) / scale,
    };
  };

  const zoomAt = (
    anchor: { x: number; y: number },
    nextZoom: number,
    prev: { zoom: number; position: { x: number; y: number } },
  ) => {
    const nextClampedZoom = clamp(nextZoom, ZOOM_MIN, ZOOM_MAX);
    const prevScale = baseScale * prev.zoom;
    const nextScale = baseScale * nextClampedZoom;
    const worldX = (anchor.x - prev.position.x) / prevScale;
    const worldY = (anchor.y - prev.position.y) / prevScale;
    const nextPosition = {
      x: anchor.x - worldX * nextScale,
      y: anchor.y - worldY * nextScale,
    };
    return {
      zoom: nextClampedZoom,
      position: constrainPosition(nextPosition, nextClampedZoom, stageSize),
    };
  };

  const setAnimatedView = (updater: (prev: typeof view) => typeof view) => {
    setView((prev) => {
      const next = updater(prev);
      return { ...next, animate: true };
    });
    if (viewAnimationTimeoutRef.current) {
      window.clearTimeout(viewAnimationTimeoutRef.current);
    }
    viewAnimationTimeoutRef.current = window.setTimeout(() => {
      setView((prev) => ({ ...prev, animate: false }));
      viewAnimationTimeoutRef.current = null;
    }, ZOOM_ANIMATION_MS);
  };

  const handlePointerDown = (e: KonvaEventObject<PointerEvent>) => {
    e.evt.preventDefault();
    if (isGestureRef.current) return;
    isPointerDownRef.current = true;
    pointerDownTimeRef.current = Date.now();
    
    const containerPoint = getContainerPoint(e.evt);
    if (!containerPoint) return;
    const localPoint = getStagePoint(containerPoint, view.zoom, view.position);

    if (tool === "lasso") {
      // Check if we clicked inside an existing selection to drag it
      if (selectionBBox) {
        const padding = 10 / stageScale;
        if (
          localPoint.x >= selectionBBox.x - padding &&
          localPoint.x <= selectionBBox.x + selectionBBox.width + padding &&
          localPoint.y >= selectionBBox.y - padding &&
          localPoint.y <= selectionBBox.y + selectionBBox.height + padding
        ) {
          return;
        }
      }
    }

    // Clear selection if we are starting a new action (unless we just returned above)
    selectBlock(null);
    setSelectedIds([]);

    if (tool === "lasso") {
      const stroke = {
        id: "lasso-current",
        pageId: "lasso",
        points: [localPoint.x, localPoint.y],
        color: "#6366f1",
        width: 1 / stageScale,
        pressures: [0.5],
      };
      setTempStroke(stroke);
      tempStrokeRef.current = stroke;
      tempPointsRef.current = [localPoint.x, localPoint.y];
      return;
    }

    if (tool === "eraser") {
      isErasingRef.current = true;
      const erased = eraseAtPoint(activePageId, localPoint);
      if (erased) historyPush({ type: "DELETE_STROKE", stroke: erased });
      return;
    }

    if (tool !== "pen") return;

    const pressure = 0.5; // Always neutral pressure

    const stroke = {
      id: nanoid(),
      pageId: activePageId,
      points: [localPoint.x, localPoint.y],
      color,
      width: strokeWidth,
      pressures: [pressure],
    };
    
    // Imperative update for smoothness
    setTempStroke(stroke);
    tempStrokeRef.current = stroke;
    tempPointsRef.current = [localPoint.x, localPoint.y];
  };

  const handlePointerMove = (e: KonvaEventObject<PointerEvent>) => {
    e.evt.preventDefault();
    if (isGestureRef.current) return;

    const containerPoint = getContainerPoint(e.evt);
    if (!containerPoint) return;
    const localPoint = getStagePoint(containerPoint, view.zoom, view.position);

    if (isErasingRef.current && tool === "eraser") {
      const erased = eraseAtPoint(activePageId, localPoint);
      if (erased) historyPush({ type: "DELETE_STROKE", stroke: erased });
      return;
    }

    if (tool !== "pen" && tool !== "lasso") return;
    if (tool === "pen" && !tempStrokeRef.current) return;
    if (tool === "lasso" && !tempStrokeRef.current) return;

    // Use coalesced events if available for smoother curves
    const rawEvents = (e.evt as any).getCoalescedEvents
      ? (e.evt as any).getCoalescedEvents()
      : [e.evt];

    // Create a local buffer to avoid repeated state updates in the loop
    const newPoints: number[] = [];

    for (const evt of rawEvents) {
      const containerPoint = getContainerPoint(evt);
      if (!containerPoint) continue;
      const localPoint = getStagePoint(containerPoint, view.zoom, view.position);

      // Optimize point capture: prevent adding points too close to each other
      if (tempPointsRef.current.length >= 2) {
        const lastX = tempPointsRef.current[tempPointsRef.current.length - 2];
        const lastY = tempPointsRef.current[tempPointsRef.current.length - 1];
        const dx = localPoint.x - lastX;
        const dy = localPoint.y - lastY;
        // Reduced threshold to 0.5px for smoother curves
        if (dx * dx + dy * dy < 0.25) continue;
      }
      else if (newPoints.length >= 2) {
         // Check against last added point in this batch
         const lastX = newPoints[newPoints.length - 2];
         const lastY = newPoints[newPoints.length - 1];
         const dx = localPoint.x - lastX;
         const dy = localPoint.y - lastY;
         if (dx * dx + dy * dy < 0.25) continue;
      }

      newPoints.push(localPoint.x, localPoint.y);
      tempPointsRef.current.push(localPoint.x, localPoint.y);
    }
    
    if (newPoints.length > 0) {
        // If we are snapping, we don't update tempStroke with raw points here
        // The snapHook will handle cancellation if we move significantly
        // But for immediate feedback, we might want to update?
        // Actually, if isSnapping is true, we should cancel first.
        // snapHook.handleMove calls onCancel which updates tempStroke.
        // So we just update tempStroke normally here, and if snap happens later, it overwrites.
        
        snapHook.handleMove(tempPointsRef.current);

        if (!snapHook.isSnapping) {
            setTempStroke((prev: any) => {
                if (!prev) return null;
                return {
                    ...prev,
                    points: [...tempPointsRef.current]
                };
            });
        }
    }
  };

  const handlePointerUp = () => {
    if (tool === "lasso" && isPointerDownRef.current && tempStrokeRef.current) {
      const current = tempStrokeRef.current;
      // Use tempPointsRef for the most up-to-date points, as current.points might be stale
      const points = tempPointsRef.current;
      
      if (current && points.length > 6) {
        const selected: string[] = [];
        
        // Use a simpler bounds check first for performance
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (let i = 0; i < points.length; i += 2) {
            minX = Math.min(minX, points[i]);
            minY = Math.min(minY, points[i+1]);
            maxX = Math.max(maxX, points[i]);
            maxY = Math.max(maxY, points[i+1]);
        }
        
        // Only check strokes that could possibly be inside the lasso bounds
        // In a real implementation with QuadTree access, we would query the QuadTree here
        // For now, filtering by pageStrokes is already better than checking global strokes
        if (selectionFilter.strokes) {
            for (const stroke of pageStrokes) {
            // Quick bounding box check
            let sMinX = Infinity, sMinY = Infinity, sMaxX = -Infinity, sMaxY = -Infinity;
            for (let i = 0; i < stroke.points.length; i += 2) {
                sMinX = Math.min(sMinX, stroke.points[i]);
                sMinY = Math.min(sMinY, stroke.points[i+1]);
                sMaxX = Math.max(sMaxX, stroke.points[i]);
                sMaxY = Math.max(sMaxY, stroke.points[i+1]);
            }
            
            if (sMaxX < minX || sMinX > maxX || sMaxY < minY || sMinY > maxY) continue;

            if (isStrokeInPolygon(stroke.points, points)) {
                selected.push(stroke.id);
            }
            }
        }
        const blocks = useBlockStore.getState().blocks;
        for (const block of blocks) {
          // Check type filter
          if (block.type === "image" && !selectionFilter.images) continue;
          if (block.type === "text" && !selectionFilter.text) continue;

          if (
            isRectInPolygon(
              { x: block.x, y: block.y, width: block.width || 400, height: 24 },
              points,
            )
          ) {
            selected.push(block.id);
          }
        }
        setSelectedIds(selected);
      }
      setTempStroke(null);
      tempStrokeRef.current = null;
      tempPointsRef.current = [];
    } else if (tempStrokeRef.current) {
      const current = tempStrokeRef.current;
      
      let finalPoints = [...tempPointsRef.current];
      let finalShapeType: string | undefined;
      let finalOriginalPoints: number[] | undefined;

      const snapped = snapHook.getSnappedShape();
      if (snapped) {
          finalPoints = snapped.points.flatMap(p => [p.x, p.y]);
          finalShapeType = snapped.type;
          finalOriginalPoints = [...tempPointsRef.current];
      }
      
      snapHook.cancelSnap();
      
      // Save final stroke to store
      const finalStroke = {
          ...current,
          points: finalPoints,
          shapeType: finalShapeType,
          originalPoints: finalOriginalPoints,
      };
      
      // We manually add it to store instead of calling endStroke which relied on state
      // Use set to ensure immediate update, but we also need to trigger re-render
      // for the DrawingLayer to see the new stroke in its props
      useCanvasStore.setState(state => ({
          strokes: [...state.strokes, finalStroke],
          currentStroke: null
      }));
      void useCanvasStore.getState().addStroke(finalStroke);
      
      historyPush({ type: "ADD_STROKE", stroke: finalStroke });
      
      setTempStroke(null);
      tempStrokeRef.current = null;
      tempPointsRef.current = [];
    }
    isPointerDownRef.current = false;
    isErasingRef.current = false;
  };

  return (
    <div ref={containerRef} className="w-full h-full">
      <div
        ref={viewportRef}
        className="relative w-full h-full overflow-hidden"
        style={{ touchAction: "none" }}
        onMouseDown={(e) => {
          if (e.target instanceof HTMLElement && e.target.closest("textarea")) {
            return;
          }
          if (e.target instanceof HTMLElement && e.target.closest("[data-canvas-ui]")) {
            return;
          }
          selectBlock(null);
        }}
        onDoubleClick={(e) => {
          if (!onDoubleClickPage) return;
          if (!activePageId) return;
          if (tool !== "text") return;
          if (e.target instanceof HTMLElement && e.target.closest("textarea")) {
            return;
          }
          if (e.target instanceof HTMLElement && e.target.closest("[data-canvas-ui]")) {
            return;
          }
          const anchor = getContainerPoint(e);
          if (!anchor) return;
          const point = getStagePoint(anchor, view.zoom, view.position);
          onDoubleClickPage(activePageId, point.x, point.y);
        }}
      >
        <Stage
          ref={stageRef}
          width={stageSize.width}
          height={stageSize.height}
          x={view.position.x}
          y={view.position.y}
          scaleX={stageScale}
          scaleY={stageScale}
          onWheel={(e) => {
            e.evt.preventDefault();

            const anchor = getContainerPoint(e.evt);
            if (!anchor) return;

            // Pinch gesture (trackpad) or Ctrl + Wheel (mouse)
            if (e.evt.ctrlKey) {
              const scaleBy = 1.02;
              const direction = e.evt.deltaY > 0 ? 1 / scaleBy : scaleBy;
              
              setAnimatedView((prev) => {
                const next = zoomAt(anchor, prev.zoom * direction, prev);
                return { ...prev, ...next, animate: false };
              });
            } else {
              // Normal scroll/trackpad movement -> Pan
              setView((prev) => ({
                ...prev,
                position: {
                  x: prev.position.x - e.evt.deltaX,
                  y: prev.position.y - e.evt.deltaY,
                },
                animate: false,
              }));
            }
          }}
          onTouchStart={(e) => {
            if (e.evt.touches.length !== 2) {
              isGestureRef.current = false;
              lastGestureCenterRef.current = null;
              lastGestureDistanceRef.current = null;
              return;
            }

            e.evt.preventDefault();
            isGestureRef.current = true;

            const rect = viewportRef.current?.getBoundingClientRect();
            if (!rect) return;

            const [t1, t2] = Array.from(e.evt.touches);
            const center = {
              x: (t1.clientX + t2.clientX) / 2 - rect.left,
              y: (t1.clientY + t2.clientY) / 2 - rect.top,
            };
            const dx = t1.clientX - t2.clientX;
            const dy = t1.clientY - t2.clientY;
            lastGestureCenterRef.current = center;
            lastGestureDistanceRef.current = Math.hypot(dx, dy);
          }}
          onTouchMove={(e) => {
            if (e.evt.touches.length !== 2) return;
            e.evt.preventDefault();

            const rect = viewportRef.current?.getBoundingClientRect();
            if (!rect) return;

            const [t1, t2] = Array.from(e.evt.touches);
            const nextCenter = {
              x: (t1.clientX + t2.clientX) / 2 - rect.left,
              y: (t1.clientY + t2.clientY) / 2 - rect.top,
            };
            const dx = t1.clientX - t2.clientX;
            const dy = t1.clientY - t2.clientY;
            const nextDistance = Math.hypot(dx, dy);

            const prevCenter = lastGestureCenterRef.current;
            const prevDistance = lastGestureDistanceRef.current;

            setView((prev) => {
              let nextPosition = prev.position;
              if (prevCenter) {
                nextPosition = {                
                  x: nextPosition.x + (nextCenter.x - prevCenter.x),
                  y: nextPosition.y + (nextCenter.y - prevCenter.y),
                };
              }

              let nextZoom = prev.zoom;
              if (prevDistance) {
                const ratio = nextDistance / prevDistance;
                nextZoom = clamp(prev.zoom * ratio, ZOOM_MIN, ZOOM_MAX);
                const anchored = zoomAt(nextCenter, nextZoom, {
                  zoom: prev.zoom,
                  position: nextPosition,
                });
                nextZoom = anchored.zoom;
                nextPosition = anchored.position;
              }

              return {
                ...prev,
                zoom: nextZoom,
                position: nextPosition,
                animate: false,
              };
            });

            lastGestureCenterRef.current = nextCenter;
            lastGestureDistanceRef.current = nextDistance;
          }}
          onTouchEnd={() => {
            isGestureRef.current = false;
            lastGestureCenterRef.current = null;
            lastGestureDistanceRef.current = null;
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={() => {
            isPointerDownRef.current = false;
            isErasingRef.current = false;
          }}
        >
          <GridLayer 
            width={stageSize.width / stageScale} 
            height={stageSize.height / stageScale} 
            minX={-view.position.x / stageScale}
            minY={-view.position.y / stageScale}
          />
          
          <ImageLayer />

          <DrawingLayer
            strokes={pageStrokes}
            currentStroke={pageCurrentStroke}
            selectedIds={selectedIds}
            selectionOffset={selectionOffset}
            viewport={{
              x: view.position.x,
              y: view.position.y,
              width: stageSize.width,
              height: stageSize.height,
              zoom: view.zoom,
            }}
          />

          <LassoLayer
            selectionBBox={selectionBBox}
            stageScale={stageScale}
            updateBlocks={updateBlocks}
            updateStrokes={updateStrokes}
            updateBlockSize={updateBlockSize}
            strokes={strokes}
            selectedIds={selectedIds}
            setSelectedIds={setSelectedIds}
            setSelectionOffset={setSelectionOffset}
          />
        </Stage>

        <div className="absolute inset-0 pointer-events-none">
          <div
            style={{
              transform: `translate3d(${view.position.x}px, ${view.position.y}px, 0) scale(${stageScale})`,
              transformOrigin: "0 0",
              width: "100%",
              height: "100%",
            }}
          >
            {children}
          </div>
        </div>

        <ImageSelectionOverlay view={view} stageScale={stageScale} />
        
        <LassoActionsOverlay 
            view={view}
            stageScale={stageScale}
            selectionBBox={selectionBBox}
            selectedIds={selectedIds}
            stageRef={stageRef}
        />

        <div
          data-canvas-ui
          className="absolute right-3 top-3 flex items-center gap-2 bg-zinc-950/60 backdrop-blur-md border border-white/10 rounded-xl px-2 py-1.5"
          style={{ pointerEvents: "auto" }}
        >
          <button
            onClick={() => {
              const anchor = { x: stageSize.width / 2, y: stageSize.height / 2 };
              setAnimatedView((prev) => {
                const next = zoomAt(anchor, prev.zoom / 1.1, prev);
                return { ...prev, ...next };
              });
            }}
            className="p-1.5 rounded-lg hover:bg-white/5 text-zinc-300"
            aria-label="Zoom out"
          >
            <Minus className="w-4 h-4" />
          </button>
          <div className="text-xs text-zinc-300 tabular-nums w-12 text-center">
            {Math.round(view.zoom * 100)}%
          </div>
          <button
            onClick={() => {
              const anchor = { x: stageSize.width / 2, y: stageSize.height / 2 };
              setAnimatedView((prev) => {
                const next = zoomAt(anchor, prev.zoom * 1.1, prev);
                return { ...prev, ...next };
              });
            }}
            className="p-1.5 rounded-lg hover:bg-white/5 text-zinc-300"
            aria-label="Zoom in"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function constrainPosition(
  position: { x: number; y: number },
  _zoom: number,
  _stageSize: { width: number; height: number },
) {
  // Allow free panning for full-page canvas
  return position;
}
