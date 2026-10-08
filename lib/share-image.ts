import { toPng } from 'html-to-image';

/**
 * Render an (offscreen) element to PNG, then hand it to the native share
 * sheet (mobile → WhatsApp etc.) or fall back to a download.
 *
 * Resolves to what happened. Throws on render failure; an AbortError means
 * the user dismissed the share sheet — callers should stay quiet on that.
 */
export async function shareOrDownloadPng(
  el: HTMLElement,
  filename: string,
  title: string
): Promise<'shared' | 'downloaded'> {
  // Let the offscreen card paint with the latest data before capture.
  await new Promise((r) => setTimeout(r, 80));
  const dataUrl = await toPng(el, {
    cacheBust: true,
    pixelRatio: 2,
    backgroundColor: '#ffffff',
  });

  const blob = await (await fetch(dataUrl)).blob();
  const file = new File([blob], filename, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    await nav.share({ files: [file], title });
    return 'shared';
  }

  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  link.click();
  return 'downloaded';
}

/** "Ramesh Patel" → "ramesh-patel" for filenames. */
export function fileSlug(name: string, fallback = 'client'): string {
  return (name || fallback).replace(/[^a-z0-9]+/gi, '-').toLowerCase();
}
