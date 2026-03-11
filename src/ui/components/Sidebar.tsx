import { useState } from "react";
import { 
  Folder as FolderIcon, 
  Book, 
  FileText, 
  ChevronRight, 
  ChevronDown, 
  Search, 
  Plus, 
  Settings,
  Trash2,
  Edit2,
  FolderPlus,
  BookPlus
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/utils";
import type { Folder } from "@/data/types";
import type { Notebook } from "@/data/types";
import type { Page } from "@/pages/types";
import { useAppStore } from "@/store/useAppStore";
import { NamingModal } from "@/ui/components/NamingModal";
import { SettingsModal } from "@/ui/components/SettingsModal";

export function Sidebar() {
  const folders = useAppStore((s) => s.folders);
  const notebooks = useAppStore((s) => s.notebooks);
  const pages = useAppStore((s) => s.pages);
  const activePageId = useAppStore((s) => s.activePageId);
  const setActivePage = useAppStore((s) => s.setActivePage);
  const addPage = useAppStore((s) => s.addPage);
  const deletePage = useAppStore((s) => s.deletePage);
  const renamePage = useAppStore((s) => s.renamePage);
  const addFolder = useAppStore((s) => s.addFolder);
  const addNotebook = useAppStore((s) => s.addNotebook);
  const deleteFolder = useAppStore((s) => s.deleteFolder);
  const deleteNotebook = useAppStore((s) => s.deleteNotebook);
  const renameFolder = useAppStore((s) => s.renameFolder);
  const renameNotebook = useAppStore((s) => s.renameNotebook);

  const [namingModal, setNamingModal] = useState<{
    isOpen: boolean;
    type: "folder" | "notebook" | "page";
    mode: "create" | "rename";
    parentId?: string; // For creating: folderId (if creating notebook) or notebookId (if creating page)
    targetId?: string; // For renaming: the id of the item being renamed
    initialValue?: string;
  }>({ isOpen: false, type: "folder", mode: "create" });
  const [showSettings, setShowSettings] = useState(false);

  const handleDeletePage = (id: string) => {
    if (confirm("Are you sure you want to delete this page?")) {
        void deletePage(id);
    }
  };

  const handleDeleteFolder = (id: string) => {
    if (confirm("Are you sure you want to delete this folder? All notebooks and pages inside will be deleted.")) {
        void deleteFolder(id);
    }
  };

  const handleDeleteNotebook = (id: string) => {
    if (confirm("Are you sure you want to delete this notebook? All pages inside will be deleted.")) {
        void deleteNotebook(id);
    }
  };

  const handleCreateNaming = (name: string) => {
    if (namingModal.mode === "rename") {
      if (namingModal.type === "folder" && namingModal.targetId) {
        void renameFolder(namingModal.targetId, name);
      } else if (namingModal.type === "notebook" && namingModal.targetId) {
        void renameNotebook(namingModal.targetId, name);
      } else if (namingModal.type === "page" && namingModal.targetId) {
        void renamePage(namingModal.targetId, name);
      }
    } else {
      if (namingModal.type === "folder") {
        const newFolder: Folder = {
          id: crypto.randomUUID(),
          name,
          parentId: null,
          createdAt: Date.now(),
        };
        void addFolder(newFolder);
      } else if (namingModal.type === "notebook") {
        const newNotebook: Notebook = {
          id: crypto.randomUUID(),
          name,
          folderId: namingModal.parentId || null,
          createdAt: Date.now(),
        };
        void addNotebook(newNotebook);
      }
    }
    setNamingModal({ ...namingModal, isOpen: false });
  };

  const handleNewPage = (notebookId?: string) => {
    const targetNotebookId = notebookId || (notebooks.length > 0 ? notebooks[0].id : null);
    
    if (targetNotebookId) {
      const newPage: Page = {
        id: crypto.randomUUID(),
        notebookId: targetNotebookId,
        title: "Untitled Page",
        type: "canvas",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        settings: {
          size: "A4",
          orientation: "portrait",
          grid: "dotted",
          zoom: 1,
        }
      };
      void addPage(newPage);
    } else {
      alert("Please create a notebook first.");
    }
  };

  return (
    <>
      <aside className="layout-sidebar h-full w-70 flex flex-col backdrop-blur-xl text-[var(--text-secondary)] transition-colors duration-300">
        {/* Header */}
        <div className="p-4 pt-6">
          <div className="flex items-center gap-2 mb-6 px-2">
            <img src="/Girok-logo-G.png" alt="GirokIQ Logo" className="w-8 h-8 object-contain" />
            <span className="font-medium text-[var(--text-primary)] tracking-tight">GirokIQ</span>
          </div>

          {/* Search */}
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)] group-focus-within:text-[var(--accent-primary)] transition-colors" />
            <input 
              type="text" 
              placeholder="Search..." 
              className="w-full bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded-lg py-2 pl-9 pr-3 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]/30 focus:bg-[var(--accent-subtle)]/10 transition-all placeholder:text-[var(--text-tertiary)]"
            />
          </div>
        </div>

        {/* Navigation Tree */}
        <div className="flex-1 overflow-y-auto px-2 py-2 scrollbar-thin scrollbar-thumb-[var(--border-strong)] scrollbar-track-transparent">
          <div className="space-y-0.5">
            <div className="px-3 py-1.5 text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
              Library
            </div>
            
            {/* Folders */}
            {folders.map(folder => (
              <FolderItem 
                key={folder.id} 
                folder={folder} 
                notebooks={notebooks.filter(n => n.folderId === folder.id)}
                pages={pages}
                activePageId={activePageId || undefined}
                onPageSelect={setActivePage}
                onDeletePage={handleDeletePage}
                onDeleteFolder={handleDeleteFolder}
                onDeleteNotebook={handleDeleteNotebook}
                onRenameNotebook={(id, name) => setNamingModal({ isOpen: true, type: "notebook", mode: "rename", targetId: id, initialValue: name })}
                onRenamePage={(id, name) => setNamingModal({ isOpen: true, type: "page", mode: "rename", targetId: id, initialValue: name })}
                onAddNotebook={(folderId) => setNamingModal({ isOpen: true, type: "notebook", mode: "create", parentId: folderId })}
                onRenameFolder={(id, name) => setNamingModal({ isOpen: true, type: "folder", mode: "rename", targetId: id, initialValue: name })}
                onAddPage={handleNewPage}
              />
            ))}

          {/* Uncategorized Notebooks (if any) */}
          {notebooks.filter(n => !n.folderId).map(notebook => (
            <NotebookItem 
              key={notebook.id} 
              notebook={notebook} 
              pages={pages.filter(p => p.notebookId === notebook.id)}
              activePageId={activePageId || undefined}
              onPageSelect={setActivePage}
              onDeletePage={handleDeletePage}
              onDeleteNotebook={handleDeleteNotebook}
              onRenameNotebook={(id, name) => setNamingModal({ isOpen: true, type: "notebook", mode: "rename", targetId: id, initialValue: name })}
              onRenamePage={(id, name) => setNamingModal({ isOpen: true, type: "page", mode: "rename", targetId: id, initialValue: name })}
              onAddPage={handleNewPage}
            />
          ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[var(--border-subtle)] space-y-1 bg-[var(--bg-sidebar)]">
          <div className="grid grid-cols-2 gap-2 mb-2">
            <button 
              onClick={() => setNamingModal({ isOpen: true, type: "folder", mode: "create" })}
              className="flex items-center justify-center gap-2 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded-lg transition-all active:scale-95 group shadow-sm"
              title="New Folder"
            >
              <FolderPlus className="w-3.5 h-3.5 group-hover:text-[var(--accent-primary)] transition-colors" />
              <span>Folder</span>
            </button>
            <button 
              onClick={() => setNamingModal({ isOpen: true, type: "notebook", mode: "create" })}
              className="flex items-center justify-center gap-2 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded-lg transition-all active:scale-95 group shadow-sm"
              title="New Notebook"
            >
              <BookPlus className="w-3.5 h-3.5 group-hover:text-[var(--accent-primary)] transition-colors" />
              <span>Notebook</span>
            </button>
          </div>
          <button 
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-3 w-full px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)] rounded-lg transition-all group"
          >
            <Settings className="w-4 h-4 group-hover:text-[var(--accent-primary)] transition-colors" />
            <span>Settings</span>
          </button>
          <button 
            onClick={() => handleNewPage()}
            className="flex items-center gap-3 w-full px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)] rounded-lg transition-all group"
          >
            <Plus className="w-4 h-4 group-hover:text-[var(--accent-primary)] transition-colors" />
            <span>New Page</span>
          </button>
        </div>

        <NamingModal
          isOpen={namingModal.isOpen}
          onClose={() => setNamingModal({ ...namingModal, isOpen: false })}
          onConfirm={handleCreateNaming}
          title={namingModal.mode === "create" ? `Create New ${namingModal.type === "folder" ? "Folder" : "Notebook"}` : `Rename ${namingModal.type}`}
          placeholder={`Enter ${namingModal.type} name...`}
          defaultValue={namingModal.initialValue}
          confirmLabel={namingModal.mode === "create" ? "Create" : "Rename"}
        />
      </aside>
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </>
  );
}

function FolderItem({ folder, notebooks, pages, activePageId, onPageSelect, onDeletePage, onDeleteFolder, onDeleteNotebook, onAddNotebook, onRenameFolder, onAddPage, onRenameNotebook, onRenamePage }: { 
  folder: Folder, 
  notebooks: Notebook[],
  pages: Page[],
  activePageId?: string,
  onPageSelect: (id: string) => void,
  onDeletePage: (id: string) => void,
  onDeleteFolder: (id: string) => void,
  onDeleteNotebook: (id: string) => void,
  onAddNotebook: (folderId: string) => void,
  onRenameFolder: (id: string, name: string) => void,
  onAddPage: (notebookId: string) => void,
  onRenameNotebook: (id: string, name: string) => void,
  onRenamePage: (id: string, name: string) => void
}) {
  const [isOpen, setIsOpen] = useState(true);
  const [isOverflowHidden, setIsOverflowHidden] = useState(false);

  return (
    <div className="mb-1">
      <div className="flex items-center group/folder">
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center flex-1 px-2 py-1.5 text-sm rounded-md hover:bg-[var(--bg-panel)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors group"
        >
          <span className="mr-1 opacity-50 group-hover:opacity-100 transition-opacity text-[var(--text-tertiary)]">
            {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </span>
          <FolderIcon className="w-4 h-4 mr-2 text-[var(--text-tertiary)] group-hover:text-[var(--accent-primary)] transition-colors" />
          <span className="truncate font-medium">{folder.name}</span>
        </button>
        <div className="flex items-center opacity-0 group-hover/folder:opacity-100 transition-opacity">
            <button
            onClick={() => onRenameFolder(folder.id, folder.name)}
            className="p-1.5 text-zinc-500 hover:text-zinc-200 transition-all"
            title="Rename Folder"
            >
            <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
            onClick={() => onAddNotebook(folder.id)}
            className="p-1.5 text-zinc-500 hover:text-zinc-200 transition-all"
            title="New Notebook in Folder"
            >
            <BookPlus className="w-3.5 h-3.5" />
            </button>
            <button
            onClick={() => onDeleteFolder(folder.id)}
            className="p-1.5 text-zinc-500 hover:text-rose-400 transition-all"
            title="Delete Folder"
            >
            <Trash2 className="w-3.5 h-3.5" />
            </button>
        </div>
      </div>

      <AnimatePresence 
        initial={false}
        onExitComplete={() => setIsOverflowHidden(true)}
      >
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            onAnimationStart={() => setIsOverflowHidden(true)}
            onAnimationComplete={() => setIsOverflowHidden(false)}
            className={cn(isOverflowHidden ? "overflow-hidden" : "overflow-visible")}
          >
            <div className="pl-4 border-l border-white/5 ml-3.5 mt-0.5 space-y-0.5">
              {notebooks.map(notebook => (
                <NotebookItem 
                  key={notebook.id} 
                  notebook={notebook} 
                  pages={pages.filter(p => p.notebookId === notebook.id)}
                  activePageId={activePageId}
                  onPageSelect={onPageSelect}
                  onDeletePage={onDeletePage}
                  onDeleteNotebook={onDeleteNotebook}
                  onAddPage={onAddPage}
                  onRenameNotebook={onRenameNotebook}
                  onRenamePage={onRenamePage}
                />
              ))}
              {notebooks.length === 0 && (
                <div className="px-2 py-1 text-xs text-zinc-700 italic">Empty folder</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NotebookItem({ notebook, pages, activePageId, onPageSelect, onDeletePage, onDeleteNotebook, onAddPage, onRenameNotebook, onRenamePage }: { 
  notebook: Notebook, 
  pages: Page[],
  activePageId?: string,
  onPageSelect: (id: string) => void,
  onDeletePage: (id: string) => void,
  onDeleteNotebook: (id: string) => void,
  onAddPage: (notebookId: string) => void,
  onRenameNotebook: (id: string, name: string) => void,
  onRenamePage: (id: string, name: string) => void
}) {
  const [isOpen, setIsOpen] = useState(true);
  const [isOverflowHidden, setIsOverflowHidden] = useState(false);

  return (
    <div className="mb-0.5">
      <div className="flex items-center group/notebook">
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center flex-1 px-2 py-1.5 text-sm rounded-md hover:bg-[var(--bg-panel)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors group"
        >
          <span className="mr-1 opacity-50 group-hover:opacity-100 transition-opacity text-[var(--text-tertiary)]">
            {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </span>
          <Book className="w-3.5 h-3.5 mr-2 text-[var(--text-tertiary)] group-hover:text-[var(--accent-primary)]/70 transition-colors" />
          <span className="truncate">{notebook.name}</span>
        </button>
        <div className="flex items-center opacity-0 group-hover/notebook:opacity-100 transition-opacity">
            <button
            onClick={() => onRenameNotebook(notebook.id, notebook.name)}
            className="p-1.5 text-zinc-500 hover:text-zinc-200 transition-all"
            title="Rename Notebook"
            >
            <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
            onClick={() => onAddPage(notebook.id)}
            className="p-1.5 text-zinc-500 hover:text-zinc-200 transition-all"
            title="New Page in Notebook"
            >
            <Plus className="w-3.5 h-3.5" />
            </button>
            <button
            onClick={() => onDeleteNotebook(notebook.id)}
            className="p-1.5 text-zinc-500 hover:text-rose-400 transition-all"
            title="Delete Notebook"
            >
            <Trash2 className="w-3.5 h-3.5" />
            </button>
        </div>
      </div>

      <AnimatePresence 
        initial={false}
        onExitComplete={() => setIsOverflowHidden(true)}
      >
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            onAnimationStart={() => setIsOverflowHidden(true)}
            onAnimationComplete={() => setIsOverflowHidden(false)}
            className={cn(isOverflowHidden ? "overflow-hidden" : "overflow-visible")}
          >
            <div className="pl-4 ml-3.5 mt-0.5 space-y-0.5">
              {pages.map(page => (
                <PageItem 
                  key={page.id} 
                  page={page} 
                  isActive={activePageId === page.id}
                  onSelect={() => onPageSelect(page.id)}
                  onDelete={() => onDeletePage(page.id)}
                  onRename={() => onRenamePage(page.id, page.title)}
                />
              ))}
              {pages.length === 0 && (
                <div className="px-2 py-1 text-xs text-zinc-700 italic">No pages</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PageItem({ page, isActive, onSelect, onDelete, onRename }: { 
  page: Page, 
  isActive: boolean, 
  onSelect: () => void,
  onDelete: () => void,
  onRename: () => void
}) {
  return (
    <div
      onClick={onSelect}
      className={cn(
        "flex items-center w-full px-2 py-1.5 rounded-md transition-all group relative cursor-pointer select-none",
        isActive 
          ? "bg-[var(--accent-subtle)]/50 text-[var(--accent-hover)] font-medium" 
          : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)]"
      )}
    >
      {isActive && (
        <motion.div 
          layoutId="active-indicator"
          className="absolute left-0 w-0.5 h-4 bg-[var(--accent-primary)] rounded-full shadow-[0_0_12px_rgba(129,140,248,0.8)]"
        />
      )}
      <FileText className={cn(
        "w-3.5 h-3.5 mr-2 transition-colors",
        isActive ? "text-[var(--accent-primary)]" : "text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)]"
      )} />
      <span className="truncate text-[13px]">{page.title}</span>
      
      {/* Page Controls */}
      <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRename();
          }}
          className="p-1 text-zinc-500 hover:text-zinc-200 transition-all"
          title="Rename Page"
        >
          <Edit2 className="w-3 h-3" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-1 text-zinc-500 hover:text-rose-400 transition-all"
          title="Delete Page"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
