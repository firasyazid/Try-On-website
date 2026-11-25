import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { garments, type RailGarment } from "./garments";

export async function getGarments(): Promise<RailGarment[]> {
  const directory = join(process.cwd(), "public", "images");
  const files = new Set(await readdir(directory));
  const imagePath = (filename: string) => files.has(filename) ? `/images/${encodeURIComponent(filename)}` : null;

  return garments.map((garment) => ({
    ...garment,
    imageSrc: imagePath(garment.filename),
    profileSrc: imagePath(garment.profileFilename),
  }));
}
