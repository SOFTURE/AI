import { buildBridgePage } from "./build-bridge-page.js";
import { buildGallery } from "./build-gallery.js";

export default async function globalSetup(): Promise<void> {
  await buildGallery();
  await buildBridgePage();
}
