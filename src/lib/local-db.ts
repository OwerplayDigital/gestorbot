/**
 * Gestorbot Local — armazenamento privado no dispositivo.
 *
 * Não depende de Supabase, Lovable Cloud ou conexão de rede.
 * IndexedDB guarda registros e arquivos binários (imagens/ícones).
 */
export const LOCAL_DB_NAME = "gestorbot-local";
export const LOCAL_DB_VERSION = 1;

export const LOCAL_STORES = [
  "plans",
  "servidores_iptv",
  "clientes",
  "transacoes",
  "renovacoes",
  "dispositivos",
  "client_notes",
  "pendencias",
  "templates_whatsapp",
  "aplicativos_catalogo",
  "client_payment_links",
  "revendedores",
  "reseller_credits",
  "local_files",
] as const;

export type LocalStoreName = (typeof LOCAL_STORES)[number];
export type LocalRecord = Record<string, unknown> & { id: string };

export interface GestorbotBackup {
  format: "gestorbot-local-backup";
  version: 1;
  createdAt: string;
  app: "Gestorbot Local";
  data: Partial<Record<LocalStoreName, LocalRecord[]>>;
}

let databasePromise: Promise<IDBDatabase> | null = null;

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Falha no IndexedDB."));
  });
}

export function openLocalDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("Este navegador não oferece armazenamento local compatível."));
  }
  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(LOCAL_DB_NAME, LOCAL_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const store of LOCAL_STORES) {
        if (!db.objectStoreNames.contains(store)) db.createObjectStore(store, { keyPath: "id" });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        databasePromise = null;
      };
      resolve(db);
    };
    request.onerror = () => {
      databasePromise = null;
      reject(request.error ?? new Error("Não foi possível abrir o banco local."));
    };
    request.onblocked = () => reject(new Error("Feche outras abas do Gestorbot para atualizar o armazenamento."));
  });

  return databasePromise;
}

export async function getAllLocal<T extends LocalRecord = LocalRecord>(store: LocalStoreName): Promise<T[]> {
  const db = await openLocalDatabase();
  const tx = db.transaction(store, "readonly");
  return requestResult(tx.objectStore(store).getAll()) as Promise<T[]>;
}

export async function getLocal<T extends LocalRecord = LocalRecord>(store: LocalStoreName, id: string): Promise<T | undefined> {
  const db = await openLocalDatabase();
  const tx = db.transaction(store, "readonly");
  return requestResult(tx.objectStore(store).get(id)) as Promise<T | undefined>;
}

export async function putLocal<T extends LocalRecord = LocalRecord>(store: LocalStoreName, value: T): Promise<T> {
  const db = await openLocalDatabase();
  const tx = db.transaction(store, "readwrite");
  await requestResult(tx.objectStore(store).put(value));
  return value;
}

export async function putManyLocal(store: LocalStoreName, values: LocalRecord[]): Promise<void> {
  const db = await openLocalDatabase();
  const tx = db.transaction(store, "readwrite");
  for (const value of values) tx.objectStore(store).put(value);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Falha ao gravar registros."));
    tx.onabort = () => reject(tx.error ?? new Error("Gravação cancelada."));
  });
}

export async function deleteLocal(store: LocalStoreName, id: string): Promise<void> {
  const db = await openLocalDatabase();
  const tx = db.transaction(store, "readwrite");
  await requestResult(tx.objectStore(store).delete(id));
}

export async function clearLocalStore(store: LocalStoreName): Promise<void> {
  const db = await openLocalDatabase();
  const tx = db.transaction(store, "readwrite");
  await requestResult(tx.objectStore(store).clear());
}

export async function createLocalBackup(): Promise<GestorbotBackup> {
  const entries = await Promise.all(LOCAL_STORES.map(async (store) => [store, await getAllLocal(store)] as const));
  return {
    format: "gestorbot-local-backup",
    version: 1,
    createdAt: new Date().toISOString(),
    app: "Gestorbot Local",
    data: Object.fromEntries(entries) as GestorbotBackup["data"],
  };
}

export function isGestorbotBackup(value: unknown): value is GestorbotBackup {
  if (!value || typeof value !== "object") return false;
  const backup = value as Partial<GestorbotBackup>;
  if (backup.format !== "gestorbot-local-backup" || backup.version !== 1 || !backup.data || typeof backup.data !== "object") return false;
  return Object.entries(backup.data).every(([store, rows]) =>
    (LOCAL_STORES as readonly string[]).includes(store) &&
    Array.isArray(rows) &&
    rows.every((row) => row && typeof row === "object" && typeof row.id === "string"),
  );
}

/** Restauração substitui os dados locais após validar o arquivo inteiro. */
export async function restoreLocalBackup(value: unknown): Promise<void> {
  if (!isGestorbotBackup(value)) throw new Error("Arquivo inválido ou incompatível com o Gestorbot Local.");
  const db = await openLocalDatabase();
  const tx = db.transaction([...LOCAL_STORES], "readwrite");
  for (const store of LOCAL_STORES) {
    const objectStore = tx.objectStore(store);
    objectStore.clear();
    for (const row of value.data[store] ?? []) objectStore.put(row);
  }
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Falha ao restaurar o backup."));
    tx.onabort = () => reject(tx.error ?? new Error("Restauração cancelada."));
  });
}
