import fs from "fs/promises";
import path from "path";

export class Storage<T> {
  constructor(private dir: string) {}

  has(id: string): Promise<boolean> {
    const fname = `${id}.json`;
    const fpath = path.resolve(this.dir, fname);
    return fs.access(fpath).then(() => true).catch(() => false);
  }

  async add(id: string, data: T): Promise<void> {
    try {
      const fname = `${id}.json`;
      const fpath = path.resolve(this.dir, fname);
      const content = JSON.stringify(data, null, 2);
      return await fs.writeFile(
        fpath,
        content,
        {
          encoding: "utf-8",
          flag: "wx", // Create the file only if it does not exist
        },
      );
    } catch (err) {
      throw new Error(
        `Failed to add entry to the storage. ID(${id}) Data(${
          JSON.stringify(data)
        })`,
        { cause: err },
      );
    }
  }

  async update(id: string, data: T): Promise<void> {
    try {
      const fname = `${id}.json`;
      const fpath = path.resolve(this.dir, fname);
      const content = JSON.stringify(data, null, 2);
      const exists = await fs.access(fpath).then(() => true).catch(() => false);
      if (!exists) {
        throw new Error(`Entry ${fpath} does not exist in the storage.`);
      }
      return fs.writeFile(
        fpath,
        content,
        {
          encoding: "utf-8",
          flag: "w",
        },
      );
    } catch (err) {
      throw new Error(
        `Failed to update entry in the storage. ID(${id}) Data(${
          JSON.stringify(data)
        })`,
        { cause: err },
      );
    }
  }

  async remove(id: string): Promise<void> {
    try {
      const fname = `${id}.json`;
      const fpath = path.resolve(this.dir, fname);
      return await fs.unlink(fpath);
    } catch (err) {
      throw new Error(`Failed to remove entry from the storage. ID(${id})`, {
        cause: err,
      });
    }
  }

  async get(id: string): Promise<T | null> {
    try {
      const fname = `${id}.json`;
      const fpath = path.resolve(this.dir, fname);
      return await fs.readFile(
        fpath,
        { encoding: "utf-8" },
      ).then((content) => JSON.parse(content));
    } catch (err) {
      throw new Error(`Failed to get entry from the storage. ID(${id})`, {
        cause: err,
      });
    }
  }

  async getAll(): Promise<T[]> {
    try {
      return await fs.readdir(this.dir).then((files) => {
        const promises = files.map((file) => {
          const fpath = path.resolve(this.dir, file);
          return fs.readFile(fpath, {
            encoding: "utf-8",
          }).then((content) => JSON.parse(content));
        });

        return Promise.all(promises);
      });
    } catch (err) {
      throw new Error("Failed to get all entries from the storage.", {
        cause: err,
      });
    }
  }
}
