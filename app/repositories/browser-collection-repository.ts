import { createIndexedDbCollectionRepository } from "../../infrastructure/persistence/indexeddb-collection-repository";

export function createBrowserCollectionRepository() {
  return createIndexedDbCollectionRepository();
}
