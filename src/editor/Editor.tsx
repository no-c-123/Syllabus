
import { useState, useEffect, useRef, type ElementType } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  MoreHorizontal, 
  Share, 
  Star, 
  Clock, 
  Maximize2, 
  Minimize2, 
  Type, 
  Sidebar as SidebarIcon,
} from "lucide-react";
import { cn } from "@/utils";
import CanvasArea from "@/editor/CanvasArea";
import { useAppStore } from "@/store/useAppStore";
import { useBlockStore } from "@/stores/useBlockStore";
import { TextBlock } from "@/ui/blocks/TextBlock";
import { useHistoryStore } from "@/history/useHistoryStore";
import type { Page } from "@/data/models/page";
import type { Notebook } from "@/data/models/notebook";
import { Toolbar } from "@/ui/toolbar/Toolbar";
import { PropertiesPanel } from "@/ui/properties/PropertiesPanel";

interface EditorProps {
  page?: Page;
  notebook?: Notebook;
}

export function Editor({ page, notebook }: EditorProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const pageId = page?.id;

  const sidebarVisible = useAppStore((s) => s.sidebarVisible);
  const setSidebarVisible = useAppStore((s) => s.setSidebarVisible);

  const blocks = useBlockStore((s) => s.blocks);
  const hydrateBlocksForPage = useBlockStore((s) => s.hydrateBlocksForPage);
  const addTextBlock = useBlockStore((s) => s.addTextBlock);
  const loadBlocksForPage = useBlockStore((s) => s.loadBlocksForPage);
  const selectedBlockId = useBlockStore((s) => s.selectedBlockId);
  const deleteBlock = useBlockStore((s) => s.deleteBlock);
  const deletePage = useAppStore((s) => s.deletePage);
  const toggleStar = useAppStore((s) => s.toggleStar);
  const historyPush = useHistoryStore((s) => s.push);
  const undo = useHistoryStore((s) => s.undo);
  const redo = useHistoryStore((s) => s.redo);
  const historyClear = useHistoryStore((s) => s.clear);

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      if (target.isContentEditable) return true;
      const tag = target.tagName.toLowerCase();
      return tag === "input" || tag === "textarea" || tag === "select";
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          void redo();
        } else {
          void undo();
        }
        return;
      }

      if ((e.key === "Backspace" || e.key === "Delete") && selectedBlockId) {
        e.preventDefault();
        const block = useBlockStore
          .getState()
          .blocks.find((b) => b.id === selectedBlockId);
        if (block) historyPush({ type: "DELETE_BLOCK", block });
        void deleteBlock(selectedBlockId);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    selectedBlockId,
    deleteBlock,
    historyPush,
    undo,
    redo,
  ]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    }
    if (showMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMenu]);

  useEffect(() => {
    if (!page) {
      loadBlocksForPage("", []);
      return;
    }
    void hydrateBlocksForPage(page.id);
  }, [page, hydrateBlocksForPage, loadBlocksForPage]);

  useEffect(() => {
    if (!pageId) return;
    historyClear();
  }, [pageId, historyClear]);

  if (!page) {
    return (
      <div className="flex-1 h-full flex items-center justify-center text-[var(--text-secondary)]">
        <div className="text-center">
          <div className="w-16 h-16 bg-[var(--bg-panel)] rounded-full flex items-center justify-center mx-auto mb-4 border border-[var(--border-subtle)]">
            <Type className="w-8 h-8 opacity-20" />
          </div>
          <p>Select a page to start writing</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 h-full flex flex-col relative overflow-hidden bg-[var(--bg-canvas)] transition-colors duration-300">
      {/* Top Bar */}
      <header className="layout-header h-14 flex items-center justify-between px-6 backdrop-blur-sm z-10 transition-colors duration-300 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-4 w-1/4">
          <ToolbarButton 
            icon={SidebarIcon} 
            onClick={() => setSidebarVisible(!sidebarVisible)}
            tooltip="Toggle Sidebar (Cmd+S)"
            active={sidebarVisible}
          />
          <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)] overflow-hidden">
            <span className="hover:text-[var(--text-primary)] cursor-pointer transition-colors truncate">
              {notebook?.name || "Notebook"}
            </span>
            <span className="text-[var(--text-tertiary)]">/</span>
            <span className="text-[var(--text-primary)] font-medium truncate">{page.title}</span>
          </div>
        </div>

        {/* Center Toolbar */}
        <div className="flex-1 flex justify-center">
            {page.type === "canvas" && <Toolbar />}
        </div>

        <div className="flex items-center justify-end gap-1 w-1/4">
          <ToolbarButton 
            icon={Clock} 
            tooltip="History" 
            onClick={() => alert("History feature coming soon!")}
          />
          <ToolbarButton 
            icon={Star} 
            tooltip={page.starred ? "Unstar" : "Star"} 
            active={page.starred}
            onClick={() => toggleStar(page.id)}
          />
          <ToolbarButton 
            icon={Share} 
            tooltip="Share" 
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              alert("Link copied to clipboard!");
            }}
          />
          <div className="w-px h-4 bg-[var(--border-subtle)] mx-2" />
          <ToolbarButton 
            icon={isFullscreen ? Minimize2 : Maximize2} 
            onClick={() => setIsFullscreen(!isFullscreen)}
            tooltip="Toggle Fullscreen" 
          />
          <div className="relative">
            <ToolbarButton 
              icon={MoreHorizontal} 
              tooltip="More" 
              onClick={() => setShowMenu(!showMenu)}
            />
            <AnimatePresence>
              {showMenu && (
                <motion.div
                  ref={menuRef}
                  initial={{ opacity: 0, scale: 0.95, y: 5 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 5 }}
                  transition={{ duration: 0.1 }}
                  className="absolute right-0 top-full mt-2 w-48 bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded-lg shadow-xl overflow-hidden z-50"
                  style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                >
                  <div className="p-1">
                    <button 
                      onClick={() => {
                        window.print();
                        setShowMenu(false);
                      }}
                      className="flex items-center w-full px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-canvas)] rounded transition-colors text-left"
                    >
                      <span className="flex-1">Export PDF</span>
                    </button>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(window.location.href);
                        setShowMenu(false);
                        alert("Link copied to clipboard!");
                      }}
                      className="flex items-center w-full px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-canvas)] rounded transition-colors text-left"
                    >
                      <span className="flex-1">Copy Link</span>
                    </button>
                    <div className="h-px bg-[var(--border-subtle)] my-1" />
                    <button 
                      onClick={() => {
                        if (confirm("Are you sure you want to delete this page?")) {
                          deletePage(page.id);
                        }
                        setShowMenu(false);
                      }}
                      className="flex items-center w-full px-3 py-2 text-sm text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded transition-colors text-left"
                    >
                      <span className="flex-1">Delete Page</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* Main Canvas Area */}
      <div className="flex-1 relative overflow-hidden bg-[var(--bg-canvas)]">
        
        {/* Properties Panel */}
        {page.type === "canvas" && (
            <div className="absolute top-4 left-4 z-20">
                <PropertiesPanel />
            </div>
        )}

        <div className="absolute inset-0">
          {page.type === "document" ? (
            <div className="h-full w-full max-w-4xl mx-auto p-12 md:p-24 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
              <textarea
                className="w-full h-full bg-transparent text-zinc-100 placeholder:text-zinc-800 text-lg leading-relaxed outline-none resize-none"
                placeholder="Start typing your notes here..."
                value={blocks[0]?.content || ""}
                onChange={async (e) => {
                  if (blocks.length === 0) {
                    const block = await addTextBlock(page.id, 0, 0);
                    void useBlockStore.getState().updateBlock(block.id, e.target.value);
                  } else {
                    void useBlockStore.getState().updateBlock(blocks[0].id, e.target.value);
                  }
                }}
              />
            </div>
          ) : (
            <CanvasArea
              onDoubleClickPage={(pageId, x, y) => {
                void addTextBlock(pageId, x, y).then((block) => {
                  historyPush({ type: "ADD_BLOCK", block });
                });
              }}
            >
              {blocks.map((block) => {
                if (block.type === "text") {
                  return <TextBlock key={block.id} block={block} />;
                }
                return null;
              })}
            </CanvasArea>
          )}
        </div>
      </div>
    </div>
  );
}

function ToolbarButton({
  icon: Icon,
  onClick,
  tooltip,
  active,
}: {
  icon: ElementType<{ className?: string }>;
  onClick?: () => void;
  tooltip?: string;
  active?: boolean;
}) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "p-2 rounded-md transition-colors",
        active 
          ? "text-[var(--accent-primary)] bg-[var(--accent-subtle)]/20" 
          : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)]"
      )}
      title={tooltip}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}
