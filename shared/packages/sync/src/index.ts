type SyncState = "stopped" | "running";
let state: SyncState = "stopped";
let cleanup: (() => void) | undefined;
export type SyncOptions = { start?: () => void | Promise<void>; stop?: () => void | Promise<void> };
export const startSync = async (options: SyncOptions = {}): Promise<boolean> => { if (state === "running") return true; state = "running"; await options.start?.(); cleanup = () => { void options.stop?.(); }; return true; };
export const stopSync = async (): Promise<boolean> => { if (state === "stopped") return true; state = "stopped"; const fn = cleanup; cleanup = undefined; fn?.(); return true; };
export const isSyncRunning = (): boolean => state === "running";
export default { startSync, stopSync, isSyncRunning };
