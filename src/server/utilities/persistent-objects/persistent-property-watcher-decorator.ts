import { PersistentMetadataKeys } from "./metadata-keys";

export function PWatch() {
  return Reflect.metadata(PersistentMetadataKeys.PAWTCH, true);
}
