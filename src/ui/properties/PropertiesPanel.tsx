
import { useUIStore } from "@/stores/useUIStore";
import { useCanvasStore } from "@/stores/useCanvasStore";
import { cn } from "@/utils";
import { ColorPicker } from "@/ui/properties/ColorPicker";
import { useState } from "react";
import { Sliders, Minimize2 } from "lucide-react";

export function PropertiesPanel() {
  const strokeWidth = useUIStore((s) => s.strokeWidth);
  const setStrokeWidth = useUIStore((s) => s.setStrokeWidth);
  const color = useUIStore((s) => s.color);
  const setColor = useUIStore((s) => s.setColor);
  const presets = useUIStore((s) => s.presets);
  const recentColors = useUIStore((s) => s.recentColors);
  const addPreset = useUIStore((s) => s.addPreset);
  const removePreset = useUIStore((s) => s.removePreset);

  const strokeStyle = useUIStore((s) => s.strokeStyle);
  const setStrokeStyle = useUIStore((s) => s.setStrokeStyle);
  const sloppiness = useUIStore((s) => s.sloppiness);
  const setSloppiness = useUIStore((s) => s.setSloppiness);
  const edges = useUIStore((s) => s.edges);
  const setEdges = useUIStore((s) => s.setEdges);
  const opacity = useUIStore((s) => s.opacity);
  const setOpacity = useUIStore((s) => s.setOpacity);
  const backgroundColor = useUIStore((s) => s.backgroundColor);
  const setBackgroundColor = useUIStore((s) => s.setBackgroundColor);

  const selectedIds = useUIStore((s) => s.selectedIds);
  const reorderElement = useCanvasStore((s) => s.reorderElement);

  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showBgColorPicker, setShowBgColorPicker] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (isCollapsed) {
    return (
      <button
        onClick={() => setIsCollapsed(false)}
        className="p-3 bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded-lg shadow-sm hover:bg-[var(--bg-canvas)] transition-colors flex items-center justify-center"
        title="Show Properties"
      >
        <Sliders className="w-5 h-5 text-[var(--text-secondary)]" />
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded-lg shadow-sm w-64">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold uppercase text-[var(--text-secondary)] tracking-wider">Properties</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCollapsed(true)}
            className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
            title="Hide Properties"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
          <Sliders className="w-4 h-4 text-[var(--text-tertiary)]" />
        </div>
      </div>

      {/* Stroke Color */}
      <div>
        <label className="text-xs text-[var(--text-tertiary)] mb-2 block">Stroke Color</label>
        <div className="flex flex-wrap gap-2">
          {presets.slice(0, 5).map((preset) => (
            <ColorButton
              key={preset}
              color={preset}
              active={preset === color}
              onClick={() => setColor(preset)}
            />
          ))}
          <button
            onClick={() => setShowColorPicker(!showColorPicker)}
            className={cn(
              "w-6 h-6 rounded-md border border-[var(--border-subtle)] transition-all flex items-center justify-center text-xs text-[var(--text-tertiary)] hover:bg-[var(--bg-canvas)]",
              showColorPicker && "bg-[var(--accent-subtle)]/20 text-[var(--accent-primary)] border-[var(--accent-primary)]/30"
            )}
            title="More colors"
          >
            +
          </button>
        </div>
        {showColorPicker && (
          <div className="mt-2 absolute z-50 left-full top-0 ml-2 bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded-lg shadow-xl p-2">
            <ColorPicker
              open={true}
              color={color}
              presets={presets}
              recentColors={recentColors}
              onChange={setColor}
              onClose={() => setShowColorPicker(false)}
              onAddPreset={addPreset}
              onRemovePreset={removePreset}
            />
          </div>
        )}
      </div>

      <div className="h-px bg-[var(--border-subtle)]" />

      {/* Background Color */}
      <div>
        <label className="text-xs text-[var(--text-tertiary)] mb-2 block">Background</label>
        <div className="flex flex-wrap gap-2">
           <button 
             onClick={() => setBackgroundColor("transparent")}
             className={cn(
                "w-6 h-6 rounded border border-[var(--border-subtle)] bg-transparent relative overflow-hidden transition-all",
                backgroundColor === "transparent" && "border-[var(--accent-primary)] shadow-[0_0_0_2px_var(--accent-subtle)]"
             )} 
             title="Transparent"
            >
             <div className="absolute inset-0 bg-[conic-gradient(#e5e7eb_90deg,transparent_90deg_180deg,#e5e7eb_180deg_270deg,transparent_270deg)] bg-[length:8px_8px] opacity-20"></div>
             <div className="absolute inset-0 border-2 border-red-400 rotate-45 transform scale-150 origin-center opacity-50"></div>
           </button>
           {presets.slice(0, 3).map((preset) => (
             <ColorButton
               key={`bg-${preset}`}
               color={preset}
               active={backgroundColor === preset}
               onClick={() => setBackgroundColor(preset)}
             />
           ))}
            <button
            onClick={() => setShowBgColorPicker(!showBgColorPicker)}
            className={cn(
              "w-6 h-6 rounded-md border border-[var(--border-subtle)] transition-all flex items-center justify-center text-xs text-[var(--text-tertiary)] hover:bg-[var(--bg-canvas)]",
              showBgColorPicker && "bg-[var(--accent-subtle)]/20 text-[var(--accent-primary)] border-[var(--accent-primary)]/30"
            )}
            title="More colors"
          >
            +
          </button>
        </div>
        {showBgColorPicker && (
          <div className="mt-2 absolute z-50 left-full top-0 ml-2 bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded-lg shadow-xl p-2">
            <ColorPicker
              open={true}
              color={backgroundColor === "transparent" ? "#ffffff" : backgroundColor}
              presets={presets}
              recentColors={recentColors}
              onChange={setBackgroundColor}
              onClose={() => setShowBgColorPicker(false)}
              onAddPreset={addPreset}
              onRemovePreset={removePreset}
            />
          </div>
        )}
      </div>

      <div className="h-px bg-[var(--border-subtle)]" />

      {/* Stroke Width */}
      <div>
        <label className="text-xs text-[var(--text-tertiary)] mb-2 block">Stroke Width</label>
        <div className="flex items-center gap-2 mb-2">
           {[1, 2, 4, 8].map((w) => (
            <button
              key={w}
              onClick={() => setStrokeWidth(w)}
              className={cn(
                "flex-1 h-8 rounded-md border border-[var(--border-subtle)] flex items-center justify-center hover:bg-[var(--bg-canvas)] transition-colors",
                strokeWidth === w && "bg-[var(--accent-subtle)]/20 border-[var(--accent-primary)]/30"
              )}
              title={`${w}px`}
            >
              <div 
                className="bg-current rounded-full" 
                style={{ width: Math.max(2, w/2), height: Math.max(2, w/2) }} 
              />
            </button>
          ))}
        </div>
        <input
          type="range"
          min="1"
          max="20"
          step="1"
          value={strokeWidth}
          onChange={(e) => setStrokeWidth(parseInt(e.target.value))}
          className="w-full h-1 bg-[var(--border-subtle)] rounded-full appearance-none cursor-pointer accent-[var(--accent-primary)]"
        />
      </div>

      {/* Stroke Style */}
      <div>
        <label className="text-xs text-[var(--text-tertiary)] mb-2 block">Stroke Style</label>
        <div className="flex gap-2">
           <button 
             onClick={() => setStrokeStyle("solid")}
             className={cn(
                "flex-1 h-8 rounded-md border border-[var(--border-subtle)] flex items-center justify-center hover:bg-[var(--bg-canvas)] transition-colors",
                strokeStyle === "solid" && "bg-[var(--accent-subtle)]/20 border-[var(--accent-primary)]/30"
             )}
            >
             <div className="w-4 h-0.5 bg-current rounded-full"></div>
           </button>
           <button 
             onClick={() => setStrokeStyle("dashed")}
             className={cn(
                "flex-1 h-8 rounded-md border border-[var(--border-subtle)] flex items-center justify-center hover:bg-[var(--bg-canvas)] transition-colors",
                strokeStyle === "dashed" && "bg-[var(--accent-subtle)]/20 border-[var(--accent-primary)]/30"
             )}
            >
             <div className="w-4 h-0.5 border-t-2 border-current border-dashed"></div>
           </button>
           <button 
             onClick={() => setStrokeStyle("dotted")}
             className={cn(
                "flex-1 h-8 rounded-md border border-[var(--border-subtle)] flex items-center justify-center hover:bg-[var(--bg-canvas)] transition-colors",
                strokeStyle === "dotted" && "bg-[var(--accent-subtle)]/20 border-[var(--accent-primary)]/30"
             )}
            >
             <div className="w-4 h-0.5 border-t-2 border-current border-dotted"></div>
           </button>
        </div>
      </div>

      {/* Sloppiness */}
      <div>
        <label className="text-xs text-[var(--text-tertiary)] mb-2 block">Sloppiness</label>
        <div className="flex gap-2">
           {[0, 1, 2].map((s) => (
               <button 
                key={s}
                onClick={() => setSloppiness(s)}
                className={cn(
                    "flex-1 h-8 rounded-md border border-[var(--border-subtle)] flex items-center justify-center hover:bg-[var(--bg-canvas)] transition-colors",
                    sloppiness === s && "bg-[var(--accent-subtle)]/20 border-[var(--accent-primary)]/30"
                )}
               >
                 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {s === 0 && <path d="M2 12s4-2 10-2 10 2 10 2" />}
                    {s === 1 && <path d="M2 12s4-4 10-4 10 4 10 4" />}
                    {s === 2 && <path d="M2 12s4-6 10-6 10 6 10 6" />}
                 </svg>
               </button>
           ))}
        </div>
      </div>

      {/* Edges */}
      <div>
        <label className="text-xs text-[var(--text-tertiary)] mb-2 block">Edges</label>
        <div className="flex gap-2">
           <button 
             onClick={() => setEdges("sharp")}
             className={cn(
                "flex-1 h-8 rounded-md border border-[var(--border-subtle)] flex items-center justify-center hover:bg-[var(--bg-canvas)] transition-colors",
                edges === "sharp" && "bg-[var(--accent-subtle)]/20 border-[var(--accent-primary)]/30"
             )}
            >
             <div className="w-4 h-4 border border-current rounded-sm"></div>
           </button>
           <button 
             onClick={() => setEdges("round")}
             className={cn(
                "flex-1 h-8 rounded-md border border-[var(--border-subtle)] flex items-center justify-center hover:bg-[var(--bg-canvas)] transition-colors",
                edges === "round" && "bg-[var(--accent-subtle)]/20 border-[var(--accent-primary)]/30"
             )}
            >
             <div className="w-4 h-4 border border-current rounded-md"></div>
           </button>
        </div>
      </div>

      {/* Opacity */}
      <div>
         <label className="text-xs text-[var(--text-tertiary)] mb-2 block">Opacity</label>
         <input
          type="range"
          min="0"
          max="100"
          value={opacity}
          onChange={(e) => setOpacity(parseInt(e.target.value))}
          className="w-full h-1 bg-[var(--border-subtle)] rounded-full appearance-none cursor-pointer accent-[var(--accent-primary)]"
        />
      </div>

      {/* Layers */}
      <div>
        <label className="text-xs text-[var(--text-tertiary)] mb-2 block">Layers</label>
        <div className="flex gap-2">
           <button 
             className="flex-1 p-1 text-xs border border-[var(--border-subtle)] rounded text-[var(--text-secondary)] hover:bg-[var(--bg-canvas)] disabled:opacity-50" 
             disabled={selectedIds.length === 0}
             onClick={() => selectedIds.forEach(id => reorderElement(id, 'front'))}
           >
             Bring to Front
           </button>
           <button 
             className="flex-1 p-1 text-xs border border-[var(--border-subtle)] rounded text-[var(--text-secondary)] hover:bg-[var(--bg-canvas)] disabled:opacity-50" 
             disabled={selectedIds.length === 0}
             onClick={() => selectedIds.forEach(id => reorderElement(id, 'back'))}
           >
             Send to Back
           </button>
        </div>
      </div>
    </div>
  );
}

function ColorButton({
  color,
  active,
  onClick,
}: {
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-6 h-6 rounded-md border transition-all",
        active 
          ? "border-[var(--accent-primary)] shadow-[0_0_0_2px_var(--accent-subtle)]" 
          : "border-[var(--border-subtle)] hover:border-[var(--text-tertiary)]"
      )}
      style={{ backgroundColor: color }}
      aria-label={`Select ${color}`}
      title={color}
    />
  );
}
