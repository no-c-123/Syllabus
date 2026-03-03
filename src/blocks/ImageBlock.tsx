import { useEffect, useRef, useState } from "react";
import { Image as KonvaImage, Transformer } from "react-konva";
import Konva from "konva";
import { useBlockStore } from "./useBlockStore";
import type { Block } from "../data/models/block";

export function ImageBlock({ 
  block, 
  isSelected, 
  onSelect,
  listening = true
}: { 
  block: Block; 
  isSelected: boolean; 
  onSelect: () => void;
  listening?: boolean;
}) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const imageRef = useRef<Konva.Image>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const updateBlockSize = useBlockStore((s) => s.updateBlockSize);
  const updateBlockPosition = useBlockStore((s) => s.updateBlockPosition);

  useEffect(() => {
    let url = block.content;
    let isBlobUrl = false;

    if (block.blob) {
        url = URL.createObjectURL(block.blob);
        isBlobUrl = true;
    }

    const img = new window.Image();
    img.src = url;
    img.onload = () => setImage(img);

    return () => {
        if (isBlobUrl) {
            URL.revokeObjectURL(url);
        }
    };
  }, [block.content, block.blob]);

  useEffect(() => {
    if (isSelected && trRef.current && imageRef.current) {
      trRef.current.nodes([imageRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected, image]);

  return (
    <>
      <KonvaImage
        ref={imageRef}
        image={image || undefined}
        x={block.x}
        y={block.y}
        width={block.width || 200}
        height={block.height || 200}
        listening={listening}
        draggable={isSelected}
        onClick={(e) => {
             e.cancelBubble = true;
             onSelect();
        }}
        onTap={(e) => {
             e.cancelBubble = true;
             onSelect();
        }}
        onMouseDown={(e) => {
            if (isSelected) e.cancelBubble = true;
        }}
        onTouchStart={(e) => {
            if (isSelected) e.cancelBubble = true;
        }}
        onDragEnd={(e) => {
          updateBlockPosition(block.id, e.target.x(), e.target.y());
        }}
        onTransformStart={() => {
            if (!trRef.current) return;
            const anchor = trRef.current.getActiveAnchor();
            // Corner anchors: keep ratio
            if (['top-left', 'top-right', 'bottom-left', 'bottom-right'].includes(anchor || '')) {
                trRef.current.keepRatio(true);
            } else {
                trRef.current.keepRatio(false);
            }
        }}
        onTransformEnd={() => {
          const node = imageRef.current;
          if (!node) return;
          
          const scaleX = node.scaleX();
          const scaleY = node.scaleY();
          
          // Reset scale to 1 and update width/height
          node.scaleX(1);
          node.scaleY(1);
          
          updateBlockPosition(block.id, node.x(), node.y());
          updateBlockSize(
            block.id,
            Math.max(5, node.width() * scaleX),
            Math.max(5, node.height() * scaleY)
          );
        }}
      />
      {isSelected && (
        <Transformer
          ref={trRef}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 5 || newBox.height < 5) {
              return oldBox;
            }
            return newBox;
          }}
          flipEnabled={false}
          enabledAnchors={[
            "top-left", "top-center", "top-right",
            "middle-right", "middle-left",
            "bottom-left", "bottom-center", "bottom-right",
          ]}
        />
      )}
    </>
  );
}
