import { getMedia } from '@/lib/media';

// Serves uploaded photos. Each upload gets a new id, so responses never change
// and can be cached forever by browsers and CDNs.
export async function GET(_: Request, { params }: RouteContext<'/media/[file]'>) {
  const id = (await params).file.match(/^([0-9a-f-]{36})\.webp$/i)?.[1];
  const row = id ? await getMedia(id) : undefined;
  if (!row) return new Response('Not found', { status: 404 });
  return new Response(new Uint8Array(row.data), {
    headers: {
      'Content-Type': row.contentType,
      'Content-Length': String(row.data.length),
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
