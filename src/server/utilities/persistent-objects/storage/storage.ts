import fs from "fs/promises";
import Storage from "node-persist";
import path from "path";

export class Storages {
  private static storageMap = new Map<string, Storage.LocalStorage>();

  private static async getStorage(name: string): Promise<Storage.LocalStorage> {
    if (!Storages.storageMap.has(name)) {
      const relPath = `./dist/persistent-storage/${name}`;
      await fs.mkdir(path.resolve(process.cwd(), relPath), { recursive: true });
      const storage = Storage.create({
        dir: relPath,
      });
      Storages.storageMap.set(name, storage);
    }

    return Storages.storageMap.get(name)!;
  }

  public static async save(storageName: string, id: string, value: object) {
    const storage = await Storages.getStorage(storageName);
    storage.updateItem(id, value);
  }

  public static async remove(storageName: string, id: string) {
    const storage = await Storages.getStorage(storageName);
    storage.removeItem(id);
  }

  public static async load(storageName: string): Promise<object[]> {
    const storage = await Storages.getStorage(storageName);
    const allEntries: object[] = await storage.values();
    return allEntries;
  }
}
