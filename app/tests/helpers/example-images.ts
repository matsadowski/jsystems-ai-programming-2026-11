// Loads the real example photos straight from ../assets/example-images (never copied, per
// assets/example-images/README.md and ADR 000 §3).
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

export const EXAMPLE_IMAGES_DIR = path.resolve(__dirname, "../../../assets/example-images");

export function exampleImageNames(): string[] {
  return readdirSync(EXAMPLE_IMAGES_DIR)
    .filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
    .sort();
}

export function exampleImagePath(name: string): string {
  return path.join(EXAMPLE_IMAGES_DIR, name);
}

export function exampleImage(name: string): Buffer {
  return readFileSync(exampleImagePath(name));
}
