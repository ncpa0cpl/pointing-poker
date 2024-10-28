import fs from "fs";

export class Usage<Type extends string> {
  private writeStream;

  constructor(
    private readonly file: string,
  ) {
    this.writeStream = fs.createWriteStream(
      this.file,
      {
        encoding: "utf8",
        flush: true,
        flags: "a",
      },
    );
  }

  logStart(type: Type) {
    const ts = new Date().toISOString();
    this.writeStream.write(`${ts}, ${type}, 1\n`);
  }

  logEnd(type: Type) {
    const ts = new Date().toISOString();
    this.writeStream.write(`${ts}, ${type}, -1\n`);
  }
}
