import { useRef, useCallback } from "react";
import { ShapeRecognizer, type RecognizedShape } from "../lib/ShapeRecognizer";

interface UseShapeSnappingProps {
  onSnap: (shape: RecognizedShape) => void;
  onCancel: () => void;
  enabled?: boolean;
}

export function useShapeSnapping({ onSnap, onCancel, enabled = true }: UseShapeSnappingProps) {
  const timeoutRef = useRef<number | null>(null);
  const isSnappingRef = useRef(false);
  const snappedShapeRef = useRef<RecognizedShape | null>(null);
  const snapOriginRef = useRef<{ x: number; y: number } | null>(null);

  // Clear any pending snap check
  const cancelSnap = useCallback(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (isSnappingRef.current) {
      isSnappingRef.current = false;
      snappedShapeRef.current = null;
      snapOriginRef.current = null;
      onCancel();
    }
  }, [onCancel]);

  // Handle pointer move - debounce the snap check
  const handleMove = useCallback((points: number[]) => {
    if (!enabled) return;
    
    // If already snapped, check if we moved significantly enough to cancel
    if (isSnappingRef.current) {
        if (snapOriginRef.current && points.length >= 2) {
            const lastX = points[points.length - 2];
            const lastY = points[points.length - 1];
            const origin = snapOriginRef.current;
            
            // Calculate distance from snap origin
            const distSquared = (lastX - origin.x) ** 2 + (lastY - origin.y) ** 2;
            
            // 20px threshold (400 squared) to allow for small jitters/lift-off movements
            if (distSquared > 400) {
                cancelSnap();
            }
        }
        return;
    }

    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }

    // Only try to snap if we have enough points and stop moving
    // 250ms delay as requested
    if (points.length > 10) {
      timeoutRef.current = window.setTimeout(() => {
        const shape = ShapeRecognizer.recognize(points);
        if (shape) {
          isSnappingRef.current = true;
          snappedShapeRef.current = shape;
          // Store the last point position at snap time
          if (points.length >= 2) {
              snapOriginRef.current = {
                  x: points[points.length - 2],
                  y: points[points.length - 1]
              };
          }
          onSnap(shape);
        }
      }, 300);
    }
  }, [enabled, onSnap, cancelSnap]);

  return {
    handleMove,
    cancelSnap,
    isSnapping: isSnappingRef.current,
    getSnappedShape: () => snappedShapeRef.current
  };
}
