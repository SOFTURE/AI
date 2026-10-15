import { readFile } from "node:fs/promises";
import { parse } from "yaml";
import { fail, USAGE_EXIT_CODE } from "../cli/failure.js";
import { inventorySchema, type Inventory, type InventoryApp } from "./schema.js";

/** Validates parsed YAML (or JSON) as an inventory; every problem is listed with its path. */
export function parseInventory(data: unknown, source: string): Inventory {
  const result = inventorySchema.safeParse(data);
  if (result.success) return result.data;
  const problems = result.error.issues.map((issue) => `  ${issue.path.join(".") || "(root)"}: ${issue.message}`);
  return fail(`inventory ${source} is not valid:\n${problems.join("\n")}`, USAGE_EXIT_CODE);
}

/** Reads and validates the inventory file. */
export async function loadInventory(path: string): Promise<Inventory> {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return fail(`cannot read inventory ${path}: ${reason}`, USAGE_EXIT_CODE);
  }
  let data: unknown;
  try {
    data = parse(text) as unknown;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return fail(`inventory ${path} is not YAML: ${reason}`, USAGE_EXIT_CODE);
  }
  return parseInventory(data, path);
}

/** The app with this slug; a slug the inventory does not list is a usage error naming the ones it does. */
export function findApp(inventory: Inventory, slug: string): InventoryApp {
  const app = inventory.apps.find((candidate) => candidate.slug === slug);
  if (app !== undefined) return app;
  const known = inventory.apps.map((candidate) => candidate.slug).join(", ") || "none";
  return fail(`the inventory has no app "${slug}" (apps: ${known})`, USAGE_EXIT_CODE);
}
