import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dist = join(dirname(fileURLToPath(import.meta.url)), "../../web/dist");
mkdirSync(dist, { recursive: true });
const index = join(dist, "index.html");
if (!existsSync(index)) {
  writeFileSync(index, "<!doctype html><title>dev</title>\n");
}
