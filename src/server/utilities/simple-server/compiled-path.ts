export type PathSegment = {
  value: string;
  isParam: boolean;
  isWildcard: boolean;
};

export type ParsedUrl = {
  params: Record<string, string>;
  wildcardValue: string | null;
};

export class CompiledPath {
  private segments: PathSegment[] = [];

  public constructor(
    path: string,
  ) {
    this.compile(path);
  }

  private compile(path: string) {
    if (path.startsWith("/")) {
      path = path.substring(1);
    }

    const parts = path.split("/");

    this.segments = parts.map((part) => {
      if (part.startsWith("*")) {
        return {
          isParam: false,
          isWildcard: true,
          value: part.substring(1),
        };
      }

      if (part.startsWith(":")) {
        return {
          isParam: true,
          isWildcard: false,
          value: part.slice(1),
        };
      }

      return {
        isParam: false,
        isWildcard: false,
        value: part,
      };
    });
  }

  public compare(
    url: string,
  ): boolean {
    if (url.startsWith("/")) {
      url = url.substring(1);
    }

    const parts = url.split("/");

    for (let i = 0; i < parts.length; i++) {
      const urlPart = parts[i];
      const segment = this.segments[i];

      if (!segment) {
        return false;
      }

      if (segment.isWildcard) {
        return true;
      }

      if (segment.isParam) {
        continue;
      }

      if (urlPart !== segment.value) {
        return false;
      }
    }

    return true;
  }

  public parse(url: string): ParsedUrl | Error {
    if (url.startsWith("/")) {
      url = url.substring(1);
    }

    const parts = url.split("/");
    const params: Record<string, string> = {};
    let wildcardValue: null | string = null;

    for (let i = 0; i < parts.length; i++) {
      const urlPart = parts[i]!;
      const segment = this.segments[i];

      if (!segment) {
        return new Error("Invalid URL");
      }

      if (segment.isWildcard) {
        wildcardValue = urlPart;
        break;
      }

      if (segment.isParam) {
        params[segment.value] = urlPart;
        continue;
      }
    }

    return {
      params,
      wildcardValue,
    };
  }
}
