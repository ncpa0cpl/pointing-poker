import { PersistentMetadataKeys } from "./metadata-keys";

export function PDependency() {
  return Reflect.metadata(PersistentMetadataKeys.DEPENDENCY, true);
}
