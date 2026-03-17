import type { LibrarySnapshot, PairedDevice } from "@/types/library";

const DATABASE_NAME = "youtube-music-bot-library";
const DATABASE_VERSION = 1;
const STORE_NAME = "snapshots";
const SNAPSHOT_KEY = "primary";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Failed to open IndexedDB"));
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

export async function loadLibrarySnapshot(): Promise<LibrarySnapshot> {
  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAME, "readonly");
  const store = transaction.objectStore(STORE_NAME);
  const snapshot = await requestToPromise(store.get(SNAPSHOT_KEY));

  database.close();

  if (snapshot) {
    return {
      ...(snapshot as LibrarySnapshot),
      syncDeviceToken:
        (snapshot as Partial<LibrarySnapshot>).syncDeviceToken ?? null,
    };
  }

  const initialSnapshot = createInitialLibrarySnapshot();
  await saveLibrarySnapshot(initialSnapshot);
  return initialSnapshot;
}

export async function saveLibrarySnapshot(
  snapshot: LibrarySnapshot,
): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAME, "readwrite");
  const store = transaction.objectStore(STORE_NAME);

  store.put(snapshot, SNAPSHOT_KEY);

  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("Failed to save library snapshot"));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Library snapshot transaction aborted"));
  });

  database.close();
}

export function createInitialLibrarySnapshot(): LibrarySnapshot {
  const deviceId = crypto.randomUUID();
  const profileId = crypto.randomUUID();
  const now = new Date().toISOString();
  const kind = window.innerWidth >= 1024 ? "desktop" : "mobile";
  const currentDevice: PairedDevice = {
    id: deviceId,
    name: inferDeviceName(kind),
    kind,
    pairedAt: now,
    isCurrentDevice: true,
    status: "available",
  };

  return {
    profileId,
    deviceId,
    updatedAt: now,
    syncSessionId: null,
    syncDeviceToken: null,
    favorites: [],
    history: [],
    savedMixes: [],
    playlists: [],
    pairedDevices: [currentDevice],
  };
}

function inferDeviceName(kind: "desktop" | "mobile"): string {
  const platform = navigator.platform || "Unknown device";
  return kind === "desktop" ? `Desktop · ${platform}` : `Mobile · ${platform}`;
}
