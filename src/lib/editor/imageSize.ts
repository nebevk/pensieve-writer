/** The data URL type for an image file, from its name. */
export function imageType(path: string): string {
  const extension = path.split(".").pop()?.toLowerCase() ?? "";
  if (extension === "png") return "image/png";
  if (extension === "gif") return "image/gif";
  if (extension === "webp") return "image/webp";
  return "image/jpeg";
}

/** True when any pixel is see-through, so the picture must stay PNG to keep it. */
export function hasTransparency(pixels: Uint8ClampedArray): boolean {
  for (let index = 3; index < pixels.length; index += 4) {
    if (pixels[index] < 255) return true;
  }
  return false;
}

/**
 * Shrink a photo before it is stored inside the chapter. GIFs stay as they are, and pictures
 * with see-through areas stay PNG, because JPEG would turn those areas black.
 */
export function shrinkImage(src: string, maxWidth = 1600): Promise<string> {
  if (src.startsWith("data:image/gif")) return Promise.resolve(src);
  const mayBeTransparent = /^data:image\/(png|webp)/.test(src);
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      if (image.width <= maxWidth) {
        resolve(src);
        return;
      }
      const canvas = document.createElement("canvas");
      const scale = maxWidth / image.width;
      canvas.width = maxWidth;
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext("2d");
      if (!context) {
        resolve(src);
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const keepAlpha =
        mayBeTransparent && hasTransparency(context.getImageData(0, 0, canvas.width, canvas.height).data);
      resolve(keepAlpha ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", 0.82));
    };
    image.onerror = () => resolve(src);
    image.src = src;
  });
}
