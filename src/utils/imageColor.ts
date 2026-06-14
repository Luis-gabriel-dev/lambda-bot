import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';

/**
 * Versão pequena/PNG da imagem via proxy de mídia do Discord — converte qualquer formato
 * (jpg/webp/gif) em PNG e ainda reduz o tamanho, deixando a leitura rápida.
 */
function toSmallPngUrl(url: string): string {
  if (url.includes('cdn.discordapp.com') || url.includes('media.discordapp.net')) {
    const proxied = url.replace('cdn.discordapp.com', 'media.discordapp.net');
    return `${proxied}${proxied.includes('?') ? '&' : '?'}format=png&width=64&height=64`;
  }
  return url;
}

/** Baixa a imagem e devolve os pixels RGBA (decodifica PNG e JPEG). Null se não der. */
async function fetchRgba(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf[0] === 0x89 && buf[1] === 0x50) return PNG.sync.read(buf).data; // assinatura PNG
    if (buf[0] === 0xff && buf[1] === 0xd8) return jpeg.decode(buf, { useTArray: true, maxMemoryUsageInMB: 1024 }).data; // JPEG
    return null;
  } catch {
    return null;
  }
}

function dominantFromRgba(data: Uint8Array): number | null {
  const buckets = new Map<number, { count: number; r: number; g: number; b: number }>();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3]! < 128) continue; // ignora transparentes
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.count++;
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
    } else {
      buckets.set(key, { count: 1, r, g, b });
    }
  }

  let best: { count: number; r: number; g: number; b: number } | null = null;
  for (const bucket of buckets.values()) if (!best || bucket.count > best.count) best = bucket;
  if (!best) return null;

  const r = Math.round(best.r / best.count);
  const g = Math.round(best.g / best.count);
  const b = Math.round(best.b / best.count);
  return (r << 16) | (g << 8) | b;
}

/** Cor predominante de uma imagem (número RGB) ou null se não conseguir ler. */
export async function dominantColor(imageUrl: string): Promise<number | null> {
  // 1) proxy → PNG pequeno (rápido, cobre todos os formatos). 2) imagem direta (PNG/JPEG).
  const data = (await fetchRgba(toSmallPngUrl(imageUrl))) ?? (await fetchRgba(imageUrl));
  return data ? dominantFromRgba(data) : null;
}
