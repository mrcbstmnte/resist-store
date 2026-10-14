// Browser-only. Phone photos can be 5–10MB; hosts like Vercel reject request
// bodies over 4.5MB. Shrinking before upload keeps them small; the server still
// re-encodes (see lib/media.ts).
const MAX_EDGE = 2000;
const KEEP_UNDER_BYTES = 2.5 * 1024 * 1024;

export async function shrink(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size <= KEEP_UNDER_BYTES) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.9));
    return blob ? new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file;
  } catch {
    return file; // Browser can't decode it; let the server decide.
  }
}
