import { useEffect, useState, useRef } from "react";
import { Sidebar } from "@/ui/components/Sidebar";
import { Editor } from "@/editor/Editor";
import { NewPageModal } from "@/ui/components/NewPageModal";
import { useAppStore } from "@/store/useAppStore";
import { useKeyboardShortcuts } from "@/ui/hooks/useKeyboardShortcuts";
import { Plus, ArrowDown } from "lucide-react";

export default function App() {
  const [loading, setLoading] = useState(true);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [showNewPageModal, setShowNewPageModal] = useState(false);
  const touchStartY = useRef(0);
  const PULL_THRESHOLD = 80;
  const GESTURE_MIN = 50;

  const hydrate = useAppStore((s) => s.hydrate);
  const pages = useAppStore((s) => s.pages);
  const notebooks = useAppStore((s) => s.notebooks);
  const activePageId = useAppStore((s) => s.activePageId);
  const addPage = useAppStore((s) => s.addPage);
  const sidebarVisible = useAppStore((s) => s.sidebarVisible);
  const settings = useAppStore((s) => s.settings);

  useKeyboardShortcuts();

  useEffect(() => {
    // Apply theme on mount and when settings change
    const applyTheme = (theme: string) => {
      if (theme === "system") {
        const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        document.documentElement.classList.toggle("dark", isDark);
      } else {
        document.documentElement.classList.toggle("dark", theme === "dark");
      }
    };
    
    applyTheme(settings.theme);
    
    // Listen for system theme changes if using system theme
    if (settings.theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = (e: MediaQueryListEvent) => document.documentElement.classList.toggle("dark", e.matches);
      mediaQuery.addEventListener("change", handler);
      return () => mediaQuery.removeEventListener("change", handler);
    }
  }, [settings.theme]);

  useEffect(() => {
    const preventDefault = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
      }
    };

    window.addEventListener("wheel", preventDefault, { passive: false });
    return () => window.removeEventListener("wheel", preventDefault);
  }, []);

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent | MouseEvent) => {
      const y = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const x = 'touches' in e ? e.touches[0].clientX : e.clientX;
      
      // Only trigger if we are in the main area and near the top
      const main = document.querySelector('main');
      if (!main) return;
      
      const rect = main.getBoundingClientRect();
      const isInMain = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
      
      if (isInMain && y <= rect.top + 100) { // Start in the top 100px of the main area
        touchStartY.current = y;
        setIsPulling(true);
      }
    };

    const handleTouchMove = (e: TouchEvent | MouseEvent) => {
      if (!isPulling) return;
      const y = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const dist = y - touchStartY.current;
      if (dist > 0) {
        setPullDistance(Math.min(dist * 0.5, PULL_THRESHOLD + 20));
        if (dist > GESTURE_MIN) {
          e.preventDefault();
        }
      }
    };

    const handleTouchEnd = () => {
      if (pullDistance >= PULL_THRESHOLD) {
        setShowNewPageModal(true);
      }
      setIsPulling(false);
      setPullDistance(0);
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: false, capture: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: false, capture: true });
    window.addEventListener("touchend", handleTouchEnd, { capture: true });
    window.addEventListener("mousedown", handleTouchStart, { capture: true });
    window.addEventListener("mousemove", handleTouchMove, { capture: true });
    window.addEventListener("mouseup", handleTouchEnd, { capture: true });

    return () => {
      window.removeEventListener("touchstart", handleTouchStart, { capture: true });
      window.removeEventListener("touchmove", handleTouchMove, { capture: true });
      window.removeEventListener("touchend", handleTouchEnd, { capture: true });
      window.removeEventListener("mousedown", handleTouchStart, { capture: true });
      window.removeEventListener("mousemove", handleTouchMove, { capture: true });
      window.removeEventListener("mouseup", handleTouchEnd, { capture: true });
    };
  }, [isPulling, pullDistance]);

  const handleCreatePage = async (type: "canvas" | "document") => {
    setShowNewPageModal(false);
    if (notebooks.length === 0) return;
    
    const newPage = {
      id: crypto.randomUUID(),
      notebookId: notebooks[0].id,
      title: "Untitled " + (type === "canvas" ? "Drawing" : "Note"),
      type,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      settings: {
        size: "A4",
        orientation: "portrait",
        grid: "dotted",
        zoom: 1,
      }
    };
    await addPage(newPage as any);
  };


  useEffect(() => {
    let cancelled = false;

    hydrate()
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [hydrate]);

  const activePage = pages.find(p => p.id === activePageId);
  const activeNotebook = activePage ? notebooks.find(n => n.id === activePage.notebookId) : undefined;

  if (loading) {
    return (
      <div className="h-screen w-screen bg-[var(--bg-app)] flex items-center justify-center text-[var(--text-secondary)]">
        <div className="animate-pulse flex flex-col items-center">
          <img src="/Girok-logo-G.png" alt="GirokIQ" className="w-12 h-12 mb-4 animate-pulse object-contain" />
          <span className="text-sm tracking-widest uppercase">Loading GirokIQ...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-[var(--bg-app)] text-[var(--text-primary)] flex overflow-hidden font-sans selection:bg-[var(--accent-primary)]/30 selection:text-[var(--accent-primary)] transition-colors duration-300">
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none opacity-50 dark:opacity-100">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[var(--accent-primary)]/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/5 rounded-full blur-[120px]" />
      </div>

      {/* Sidebar */}
      <div 
        className={`relative z-20 h-full shrink-0 transition-[width,margin,opacity] duration-300 ease-in-out overflow-hidden ${
          sidebarVisible ? "w-72 opacity-100" : "w-0 opacity-0"
        }`}
      >
        <div className="w-72 h-full">
          <Sidebar />
        </div>
      </div>

      {/* Main Content */}
      <main className="relative z-10 flex-1 h-full min-w-0 transition-all duration-300 ease-in-out">
        {/* Pull to refresh visual feedback */}
        <div 
          className="absolute top-0 left-0 right-0 flex justify-center pointer-events-none z-60"
          style={{ transform: `translateY(${pullDistance - 40}px)`, opacity: pullDistance / PULL_THRESHOLD }}
        >
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--bg-panel)] border border-[var(--border-subtle)] shadow-xl transition-colors ${pullDistance >= PULL_THRESHOLD ? 'text-[var(--accent-primary)] border-[var(--accent-primary)]/30' : 'text-[var(--text-secondary)]'}`}>
            {pullDistance >= PULL_THRESHOLD ? <Plus className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
            <span className="text-xs font-medium uppercase tracking-wider">
              {pullDistance >= PULL_THRESHOLD ? 'Release for New Page' : 'Pull for New Page'}
            </span>
          </div>
        </div>

        <Editor 
          key={activePage?.id ?? "empty"}
          page={activePage} 
          notebook={activeNotebook}
        />
      </main>

      <NewPageModal 
        isOpen={showNewPageModal} 
        onClose={() => setShowNewPageModal(false)}
        onSelect={handleCreatePage}
      />
    </div>
  );
}
