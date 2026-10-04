import { writeCatalog } from "./populate"

if (import.meta.main) {
  await writeCatalog("overwrite")
}
