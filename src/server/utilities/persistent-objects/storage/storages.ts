import fs from "fs/promises";
import path from "path";
import { ROOT_DIR } from "../../../root-dir";
import { Storage } from "./storage";

export class Storages {
  private static storageMap = new Map<string, Storage<any>>();

  private static async getStorage(name: string): Promise<Storage<any>> {
    if (!Storages.storageMap.has(name)) {
      const dirpath = path.resolve(
        ROOT_DIR,
        `./dist/persistent-storage/${name}`,
      );
      await fs.mkdir(dirpath, { recursive: true });
      const storage = new Storage(dirpath);
      Storages.storageMap.set(name, storage);
    }

    return Storages.storageMap.get(name)!;
  }

  public static has(storageName: string, id: string): Promise<boolean> {
    return Storages.getStorage(storageName).then(storage => storage.has(id));
  }

  public static async create(storageName: string, id: string, value: object) {
    const storage = await Storages.getStorage(storageName);
    storage.add(id, value);
  }

  public static async update(storageName: string, id: string, value: object) {
    const storage = await Storages.getStorage(storageName);
    storage.update(id, value);
  }

  public static async remove(storageName: string, id: string) {
    const storage = await Storages.getStorage(storageName);
    storage.remove(id);
  }

  public static async load(storageName: string): Promise<object[]> {
    const storage = await Storages.getStorage(storageName);
    const allEntries: object[] = await storage.getAll();
    return allEntries;
  }
}
