import { buildGallery } from "./build-gallery.js";

export default async function globalSetup(): Promise<void> {
  await buildGallery();
}
