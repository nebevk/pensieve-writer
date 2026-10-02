/** Shrink a photo before it is stored inside the chapter. GIFs stay as they are. */
export function shrinkImage(src: string, maxWidth = 1600): Promise<string> {
  if (src.startsWith("data:image/gif")) return Promise.resolve(src);
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
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    image.onerror = () => resolve(src);
    image.src = src;
  });
}
