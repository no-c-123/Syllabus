import { db } from "../db";
import { supabase } from "./supabase";
import type { Table } from "dexie";

// Map Dexie table names to Supabase table names
const TABLE_MAPPING: Record<string, string> = {
  folders: "folders",
  notebooks: "notebooks",
  pages: "pages",
  blocks: "blocks",
  strokes: "strokes",
  canvasElements: "canvas_elements",
  appState: "app_state",
};

class SyncService {
  private isSyncing = false;
  private userId: string | null = null;

  constructor() {
    this.setupHooks();
  }

  setUserId(id: string | null) {
    this.userId = id;
    if (id) {
      this.syncAll();
    }
  }

  async syncAll() {
    if (!this.userId) return;
    // Pull first to get any remote changes
    await this.pullAll();
    // Then push any local changes
    await this.pushAll();
  }

  private setupHooks() {
    const tables = Object.keys(TABLE_MAPPING);
    const self = this;

    tables.forEach((tableName) => {
      // @ts-ignore
      const table = db[tableName] as Table<any, any>;

      if (!table) return;

      table.hook("creating", function (_primKey: any, obj: any, _transaction: any) {
        // @ts-ignore
        this.onsuccess = function (resultKey: any) {
          if (self.isSyncing || !self.userId) return;
          self.pushChange(tableName, "INSERT", { ...obj, id: resultKey });
        };
      });

      table.hook("updating", function (mods: any, primKey: any, obj: any, _transaction: any) {
        // @ts-ignore
        this.onsuccess = function (_updatedKey: any) {
          if (self.isSyncing || !self.userId) return;
          // mods contains the modifications. obj is the old object.
          // We merge to get the final state.
          // Note: This is a shallow merge. Deep merge might be needed if mods are partial.
          // But usually Dexie updates are either full replace (put) or shallow patches.
          const finalObj = { ...obj, ...mods, id: primKey };
          self.pushChange(tableName, "UPDATE", finalObj);
        };
      });

      table.hook("deleting", function (primKey: any, _obj: any, _transaction: any) {
        // @ts-ignore
        this.onsuccess = function () {
          if (self.isSyncing || !self.userId) return;
          self.pushChange(tableName, "DELETE", { id: primKey });
        };
      });
    });
  }

  private async pushChange(dexieTableName: string, type: "INSERT" | "UPDATE" | "DELETE", data: any) {
    if (!this.userId) return;

    const supabaseTableName = TABLE_MAPPING[dexieTableName];
    
    try {
      if (type === "DELETE") {
        await supabase.from(supabaseTableName).delete().match({ id: data.id });
      } else {
        const mappedData = await this.mapToSupabase(dexieTableName, { ...data, user_id: this.userId });
        // Upsert is safer
        const { error } = await supabase.from(supabaseTableName).upsert(mappedData);
        if (error) throw error;
      }
    } catch (error) {
      console.error(`Failed to push change to ${supabaseTableName}:`, error);
    }
  }

  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  private async mapToSupabase(dexieTableName: string, data: any) {
    const common = {
      id: data.id,
      user_id: data.user_id,
      created_at: data.createdAt,
      updated_at: data.updatedAt,
    };

    // Remove undefined values
    const clean = (obj: any) => {
      Object.keys(obj).forEach(key => obj[key] === undefined && delete obj[key]);
      return obj;
    };

    switch (dexieTableName) {
      case "folders":
        return clean({ ...common, parent_id: data.parentId, name: data.name });
      case "notebooks":
        return clean({ ...common, folder_id: data.folderId, name: data.name });
      case "pages":
        return clean({ ...common, notebook_id: data.notebookId, title: data.title, type: data.type, settings: data.settings });
      case "blocks":
        // Handle Blob to Base64 conversion
        let content = data.content;
        if (data.blob && data.blob instanceof Blob) {
            try {
                content = await this.blobToBase64(data.blob);
            } catch (e) {
                console.error("Failed to convert blob to base64 for sync", e);
            }
        } else if (content === "blob" && !data.blob) {
            // If content is "blob" but no blob object, we can't sync content properly.
        }

        return clean({
          ...common,
          page_id: data.pageId,
          type: data.type,
          x: data.x,
          y: data.y,
          width: data.width,
          height: data.height,
          content: content,
          // blob field is excluded from Supabase payload
        });
      case "strokes":
        return clean({
          ...common,
          page_id: data.pageId,
          points: data.points,
          color: data.color,
          width: data.width,
          pressures: data.pressures,
          shape_type: data.shapeType,
          original_points: data.originalPoints,
        });
      case "canvasElements":
        return clean({
          ...common,
          page_id: data.pageId,
          type: data.type,
          x: data.x,
          y: data.y,
          width: data.width,
          height: data.height,
          rotation: data.rotation,
          opacity: data.opacity,
          content: data.content,
        });
      case "appState":
        return clean({
          key: data.key,
          user_id: data.user_id,
          value: data.value,
          updated_at: data.updatedAt,
        });
      default:
        return data;
    }
  }

  private mapFromSupabase(dexieTableName: string, data: any) {
    // Basic mapping
    const common = {
      id: data.id,
      createdAt: data.created_at ? Number(data.created_at) : undefined,
      updatedAt: data.updated_at ? Number(data.updated_at) : undefined,
    };

    switch (dexieTableName) {
      case "folders":
        return { ...common, parentId: data.parent_id, name: data.name };
      case "notebooks":
        return { ...common, folderId: data.folder_id, name: data.name };
      case "pages":
        return { ...common, notebookId: data.notebook_id, title: data.title, type: data.type, settings: data.settings };
      case "blocks":
        return {
          ...common,
          pageId: data.page_id,
          type: data.type,
          x: data.x,
          y: data.y,
          width: data.width,
          height: data.height,
          content: data.content,
        };
      case "strokes":
        return {
          ...common,
          pageId: data.page_id,
          points: data.points,
          color: data.color,
          width: data.width,
          pressures: data.pressures,
          shapeType: data.shape_type,
          originalPoints: data.original_points,
        };
      case "canvasElements":
        return {
          ...common,
          pageId: data.page_id,
          type: data.type,
          x: data.x,
          y: data.y,
          width: data.width,
          height: data.height,
          rotation: data.rotation,
          opacity: data.opacity,
          content: data.content,
        };
      case "appState":
        return {
          key: data.key,
          value: data.value,
          updatedAt: data.updated_at ? Number(data.updated_at) : undefined,
        };
      default:
        return data;
    }
  }

  async pushAll() {
    if (!this.userId) return;
    this.isSyncing = true;
    console.log("Starting full push...");

    try {
      const tables = Object.keys(TABLE_MAPPING);

      for (const dexieTableName of tables) {
        // @ts-ignore
        const table = db[dexieTableName] as Table<any, any>;
        const allItems = await table.toArray();

        if (allItems.length === 0) continue;

        const supabaseTableName = TABLE_MAPPING[dexieTableName];
        
        // Chunking with smaller batches for heavy tables
        const chunkSize = (dexieTableName === 'strokes' || dexieTableName === 'blocks') ? 20 : 50;
        
        for (let i = 0; i < allItems.length; i += chunkSize) {
            const chunk = allItems.slice(i, i + chunkSize);
            const mappedItems = await Promise.all(chunk.map(item => this.mapToSupabase(dexieTableName, { ...item, user_id: this.userId })));
            
            const { error } = await supabase.from(supabaseTableName).upsert(mappedItems);
            if (error) console.error(`Failed to push chunk to ${supabaseTableName}:`, error);
        }
        console.log(`Pushed ${allItems.length} records for ${dexieTableName}`);
      }
    } catch (err) {
      console.error("Push failed:", err);
    } finally {
      this.isSyncing = false;
    }
  }

  async pullAll() {
    if (!this.userId) return;
    this.isSyncing = true;
    console.log("Starting full sync...");

    try {
      const tables = Object.keys(TABLE_MAPPING);

      for (const dexieTableName of tables) {
        const supabaseTableName = TABLE_MAPPING[dexieTableName];
        // @ts-ignore
        const table = db[dexieTableName] as Table<any, any>;

        let allData: any[] = [];
        let page = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
            const { data, error } = await supabase
                .from(supabaseTableName)
                .select("*")
                .range(page * pageSize, (page + 1) * pageSize - 1);

            if (error) {
                console.error(`Error pulling ${supabaseTableName}:`, error);
                hasMore = false;
                break;
            }

            if (data && data.length > 0) {
                allData = [...allData, ...data];
                if (data.length < pageSize) {
                    hasMore = false;
                } else {
                    page++;
                }
            } else {
                hasMore = false;
            }
        }

        if (allData.length > 0) {
          const dexieData = allData.map((item) => this.mapFromSupabase(dexieTableName, item));
          await table.bulkPut(dexieData);
          console.log(`Synced ${allData.length} records for ${dexieTableName}`);
        }
      }
    } catch (err) {
      console.error("Sync failed:", err);
    } finally {
      this.isSyncing = false;
    }
  }
}

export const syncService = new SyncService();
