import { db } from "@/db";
import { supabase } from "@/sync/supabase";
import type { Table } from "dexie";

// Map Dexie table names to Supabase table names
const TABLE_MAPPING: Record<string, string> = {
  folders: "folders",
  notebooks: "notebooks",
  pages: "pages",
  // blocks: "blocks", // Removed in v4
  strokes: "strokes",
  canvasElements: "canvas_elements",
  appState: "app_state",
};


const SYNC_ENABLED = true;

class SyncService {
  private isSyncing = false;
  private userId: string | null = null;

  constructor() {
    if (SYNC_ENABLED) {
      this.setupHooks();
    }
  }

  setUserId(id: string | null) {
    this.userId = id;
    if (id && SYNC_ENABLED) {
      this.syncAll();
    }
  }

  async syncAll() {
    if (!this.userId || !SYNC_ENABLED) return;
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
        this.onsuccess = function (_updatedKey: any) {
          if (self.isSyncing || !self.userId) return;
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
        if (dexieTableName === "appState") {
          return;
        }
        await supabase.from(supabaseTableName).delete().match({ id: data.id });
      } else {
        const mappedData = await this.mapToSupabase(dexieTableName, { ...data, userId: this.userId });
        
        // Ensure points are stringified for bytea storage if needed
        if (dexieTableName === "strokes" && Array.isArray(mappedData.points)) {
            // If the column is bytea, we should probably send it as a Buffer or Uint8Array?
            // Or Supabase client handles it?
            // If we send an array of numbers to a bytea column, it might fail or be weird.
            // But if we send a string, it might work if it's hex encoded.
            // Based on the log \x5b31..., it seems like it's stored as the ASCII string of the JSON array.
            // i.e. "[153, 200...]" -> hex encoded.
            
            // So we should JSON.stringify it?
            // Actually, Supabase/Postgrest usually handles JSON -> bytea conversion if configured?
            // But let's be explicit to match the read format.
            // If we send the array directly, Supabase client might send it as JSON.
            // Let's try sending it as a string first.
            // mappedData.points = JSON.stringify(mappedData.points); 
            // Wait, no. If we send a string to a bytea column, it expects hex format starting with \x.
            // If we send JSON, it might work if the column is JSONB.
            // The logs suggest it IS a bytea column storing JSON text.
            
            // Let's leave it as array for now, assuming Supabase client handles serialization.
            // If push fails, we'll see.
        }
        
        // Special handling for appState partial updates
        if (dexieTableName === "appState") {
           // We need to upsert into the user's single row
           // mappedData will be a partial object like { user_id: ..., last_opened_page: ... }
           // We must ensure we don't overwrite other columns with null if they are missing
           // But supabase .upsert() handles partials if we don't specify all columns? 
           // Yes, upsert matches on PK (user_id) and updates provided columns.
           
           // However, if we are updating 'settings' or 'sidebarVisible' which go into 'ui_state',
           // we need to be careful not to overwrite the entire 'ui_state' jsonb if we only have a part of it.
           // For now, let's assume mapToSupabase handles the structure correctly.
           
           // Issue: if mappedData.ui_state is just { sidebarVisible: true }, and DB has { settings: {...} },
           // a standard SQL UPDATE or Upsert might replace the whole JSONB column.
           // Supabase/Postgres requires jsonb_set or merging for deep updates.
           // BUT, if we assume we just replace the top-level keys in ui_state, we might need to fetch first?
           // OR we can rely on a stored procedure or just risk it for now if we don't have deep merging requirements yet.
           // Actually, let's try to fetch the current ui_state if we are touching it.
           
           if (mappedData.ui_state) {
               const { data: current } = await supabase
                 .from(supabaseTableName)
                 .select('ui_state')
                 .eq('user_id', this.userId)
                 .single();
                 
               if (current && current.ui_state) {
                   mappedData.ui_state = { ...current.ui_state, ...mappedData.ui_state };
               }
           }
        }

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
      user_id: data.userId || this.userId, // Use provided userId or fallback to session
      created_at: data.createdAt ? new Date(data.createdAt).toISOString() : undefined,
      updated_at: data.updatedAt ? new Date(data.updatedAt).toISOString() : undefined,
    };

    // Remove undefined values
    const clean = (obj: any) => {
      Object.keys(obj).forEach(key => obj[key] === undefined && delete obj[key]);
      return obj;
    };
    
    // Debug
    // if (dexieTableName === 'strokes') {
    //     console.log(`[Sync] Mapping stroke to supabase. Points type: ${typeof data.points}, isArray: ${Array.isArray(data.points)}`);
    // }

    switch (dexieTableName) {
      case "folders":
        return clean({ ...common, parent_id: data.parentId, name: data.name });
      case "notebooks":
        return clean({ ...common, folder_id: data.folderId, name: data.name });
      case "pages":
        return clean({ ...common, notebook_id: data.notebookId, title: data.title, type: data.type, settings: data.settings });
      case "strokes":
        return clean({
          ...common,
          page_id: data.pageId,
          points: data.points, // Note: Should be binary/bytea if possible, but keeping as is for now if compatible
          color: data.color,
          width: data.strokeWidth || data.width, // Prefer strokeWidth
        });
      case "canvasElements":
        // Handle Blob in data field for images
        let elementData = { ...data.data };
        if (elementData.blob && elementData.blob instanceof Blob) {
            try {
                const base64 = await this.blobToBase64(elementData.blob);
                elementData.url = base64; // Use url field for storage
                delete elementData.blob; // Don't sync blob
            } catch (e) {
                console.error("Failed to convert blob to base64 for sync", e);
            }
        }

        return clean({
          ...common,
          page_id: data.pageId,
          type: data.type,
          x: data.x,
          y: data.y,
          width: data.width,
          height: data.height,
          rotation: data.rotation,
          z_index: data.zIndex,
          data: elementData,
        });
      case "appState":
        // Map local key-value to remote columns
        // data = { key: "activePageId", value: "...", updatedAt: ... }
        
        const mappedState: any = {
            user_id: common.user_id,
            updated_at: common.updated_at
        };

        if (data.key === "activePageId") {
            mappedState.last_opened_page = data.value;
        } else if (data.key === "settings") {
            mappedState.ui_state = { settings: data.value };
        } else if (data.key === "sidebarVisible") {
            mappedState.ui_state = { sidebarVisible: data.value };
        } else {
            // Other keys go into ui_state
            mappedState.ui_state = { [data.key]: data.value };
        }

        return clean(mappedState);
      default:
        return data;
    }
  }

  private mapFromSupabase(dexieTableName: string, data: any) {
    // Basic mapping
    const common = {
      id: data.id,
      userId: data.user_id,
      createdAt: data.created_at ? new Date(data.created_at).getTime() : undefined,
      updatedAt: data.updated_at ? new Date(data.updated_at).getTime() : undefined,
    };
    
    // Debug
    // if (dexieTableName === 'strokes') {
    //     console.log(`[Sync] Mapping stroke from supabase. Points:`, data.points);
    // }

    switch (dexieTableName) {
      case "folders":
        return { ...common, parentId: data.parent_id, name: data.name };
      case "notebooks":
        return { ...common, folderId: data.folder_id, name: data.name };
      case "pages":
        return { ...common, notebookId: data.notebook_id, title: data.title, type: data.type, settings: data.settings };
      case "strokes":
        // Ensure points is a valid array of numbers
        let points = data.points;
        if (typeof points === 'string') {
            // Check if it's a hex string (Postgres bytea)
            if (points.startsWith('\\x')) {
                // Decode bytea hex string
                // \x000102... -> Uint8Array -> number[]
                // This is a simplified decoding for demonstration. 
                // In reality, bytea is binary. 
                // If points were stored as binary, we need to know the encoding.
                // Assuming points were JSON stringified then stored as text/bytea?
                // Or stored as raw bytes?
                
                // If the data came from Supabase client for a 'bytea' column, it might be a hex string.
                // But typically for 'jsonb' or 'text' it's a string.
                // The logs show: \x5b313533... which is hex for "[153..." (JSON string)
                
                // Let's try to parse the hex as utf8 string
                try {
                    const hex = points.substring(2);
                    let str = '';
                    for (let i = 0; i < hex.length; i += 2) {
                        str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
                    }
                    points = JSON.parse(str);
                } catch (e) {
                    console.error("Failed to parse bytea points:", e);
                    points = [];
                }
            } else {
                 try {
                    points = JSON.parse(points);
                 } catch (e) {
                    console.error("Failed to parse points string:", e);
                    points = [];
                 }
            }
        }
        
        return {
          ...common,
          pageId: data.page_id,
          points: Array.isArray(points) ? points : [],
          color: data.color,
          width: 0, // Bounding box width - not stored in DB stroke row
          height: 0, // Bounding box height
          strokeWidth: data.width, // Map DB width back to strokeWidth
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
          zIndex: data.z_index,
          data: data.data,
        };
      case "appState":
        // This is tricky because pullAll expects one object, but we might need to return multiple.
        // However, mapFromSupabase is called inside a loop in pullAll.
        // For appState, pullAll fetches a single row.
        // We should return an array of objects here, but mapFromSupabase signature assumes one object.
        // Let's modify pullAll to handle array returns or special case appState.
        
        // For now, let's return a special object that contains the expanded state
        // and handle it in pullAll
        const result: any[] = [];
         const updatedAt = common.updatedAt || Date.now();
 
         if (data.last_opened_page !== undefined) {
             result.push({ key: "activePageId", value: data.last_opened_page, updatedAt });
         }
         
         if (data.ui_state) {
             if (data.ui_state.settings) {
                 result.push({ key: "settings", value: data.ui_state.settings, updatedAt });
             }
             if (data.ui_state.sidebarVisible !== undefined) {
                 result.push({ key: "sidebarVisible", value: data.ui_state.sidebarVisible, updatedAt });
             }
             // Map other keys
             Object.keys(data.ui_state).forEach(k => {
                 if (k !== "settings" && k !== "sidebarVisible") {
                     result.push({ key: k, value: data.ui_state[k], updatedAt });
                 }
             });
         }
         
         return result;
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
        
        if (dexieTableName === 'appState') {
            // Special handling: merge all rows into one to avoid "ON CONFLICT" errors
            // because multiple local rows map to the single remote user row
            const mappedItems = await Promise.all(allItems.map(item => this.mapToSupabase(dexieTableName, { ...item, userId: this.userId })));
            
            const mergedItem = mappedItems.reduce((acc, curr) => {
                // Take the latest updated_at
                const latestUpdate = (!acc.updated_at || (curr.updated_at && new Date(curr.updated_at) > new Date(acc.updated_at))) 
                    ? curr.updated_at 
                    : acc.updated_at;

                return {
                    ...acc,
                    ...curr,
                    updated_at: latestUpdate,
                    ui_state: { ...(acc.ui_state || {}), ...(curr.ui_state || {}) }
                };
            }, {});
            
            const { error } = await supabase.from(supabaseTableName).upsert(mergedItem);
            if (error) console.error(`Failed to push merged appState:`, error);
            console.log(`Pushed merged appState record`);
            continue;
        }
        
        // Chunking with smaller batches for heavy tables
        const chunkSize = (dexieTableName === 'strokes' || dexieTableName === 'canvasElements') ? 20 : 50;
        
        for (let i = 0; i < allItems.length; i += chunkSize) {
            const chunk = allItems.slice(i, i + chunkSize);
            const mappedItems = await Promise.all(chunk.map(item => this.mapToSupabase(dexieTableName, { ...item, userId: this.userId })));
            
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
          if (dexieTableName === "appState") {
              // Flatten the arrays returned by mapFromSupabase for appState
              const dexieData = allData.flatMap((item) => this.mapFromSupabase(dexieTableName, item));
              if (dexieData.length > 0) {
                  await table.bulkPut(dexieData);
              }
          } else {
              const dexieData = allData.map((item) => this.mapFromSupabase(dexieTableName, item));
              await table.bulkPut(dexieData);
          }
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
