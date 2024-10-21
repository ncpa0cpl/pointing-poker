import fs from "fs/promises";
import path from "path";

export class Storage<T> {
  constructor(private dir: string) {}

  has(id: string): Promise<boolean> {
    const fname = `${id}.json`;
    const fpath = path.resolve(this.dir, fname);
    return fs.access(fpath).then(() => true).catch(() => false);
  }

  add(id: string, data: T): Promise<void> {
    const fname = `${id}.json`;
    const fpath = path.resolve(this.dir, fname);
    const content = JSON.stringify(data);
    return fs.writeFile(
      fpath,
      content,
      {
        encoding: "utf-8",
        flag: "wx", // Create the file only if it does not exist
      },
    );
  }

  async update(id: string, data: T): Promise<void> {
    const fname = `${id}.json`;
    const fpath = path.resolve(this.dir, fname);
    const content = JSON.stringify(data);
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
  }

  remove(id: string): Promise<void> {
    const fname = `${id}.json`;
    const fpath = path.resolve(this.dir, fname);
    return fs.unlink(fpath);
  }

  get(id: string): Promise<T | null> {
    const fname = `${id}.json`;
    const fpath = path.resolve(this.dir, fname);
    return fs.readFile(
      fpath,
      { encoding: "utf-8" },
    ).then((content) => JSON.parse(content));
  }

  getAll(): Promise<T[]> {
    return fs.readdir(this.dir).then((files) => {
      const promises = files.map((file) => {
        const fpath = path.resolve(this.dir, file);
        return fs.readFile(fpath, {
          encoding: "utf-8",
        }).then((content) => JSON.parse(content));
      });

      return Promise.all(promises);
    });
  }
}
