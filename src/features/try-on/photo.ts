export const photoTypes = ["image/jpeg", "image/png", "image/webp"] as const;
export const maxPhotoBytes = 8 * 1024 * 1024;

export function acceptsPhoto(type: string) {
  return photoTypes.some((format) => format === type);
}
