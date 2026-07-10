import { readFile } from 'fs/promises';
import { join } from 'path';

const CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export async function GET(_req: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;

  if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
    return new Response('Invalid filename', { status: 400 });
  }

  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const contentType = CONTENT_TYPES[ext];
  if (!contentType) {
    return new Response('Unsupported file type', { status: 400 });
  }

  try {
    const filePath = join(process.cwd(), 'public', 'uploads', filename);
    const file = await readFile(filePath);
    return new Response(file, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return new Response('File not found', { status: 404 });
  }
}
