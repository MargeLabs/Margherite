const SIZE = 480;

/**
 * Recadre la photo choisie en carré (le centre), la réduit à 480 px et la ré-encode en JPEG : environ 40 Ko,
 * assez léger pour tenir dans la ligne du bébé. L'orientation EXIF des photos d'iPhone est respectée.
 */
export async function photoToDataUrl(file: File): Promise<string> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const side = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Image impossible à traiter.');
  ctx.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  bmp.close();
  return canvas.toDataURL('image/jpeg', 0.82);
}
