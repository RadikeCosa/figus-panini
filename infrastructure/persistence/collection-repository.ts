import type { CollectionState } from "../../domain/collection/collection";

export interface CollectionRepository {
  load(): Promise<CollectionState>;
  save(collection: CollectionState): Promise<void>;
  clear(): Promise<void>;
}
