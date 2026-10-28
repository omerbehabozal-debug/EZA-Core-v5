'use client';

import SainaMessageBody from '@/components/standalone/SainaMessageBody';
import type { PublicBusinessBlock } from '@/lib/eza/mirror/journey/businessMedia';
import { businessMediaUrl } from '@/lib/eza/mirror/journey/businessMedia';

export function BusinessAnswerBody({ text, blocks, layout }: { text: string; blocks?: PublicBusinessBlock[]; layout: 'mobile' | 'desktop' }) {
  return (
    <>
      <SainaMessageBody message={text} role="ai" />
      {blocks?.length ? <BusinessMediaBlocks blocks={blocks} layout={layout} /> : null}
    </>
  );
}

/** Approved brand media inside an existing Yansı or Business answer. */
export default function BusinessMediaBlocks({ blocks, layout }: { blocks: PublicBusinessBlock[]; layout: 'mobile' | 'desktop' }) {
  if (!blocks.length) return null;
  return (
    <div
      className="mt-3 flex w-full max-w-xl flex-col gap-3"
      data-testid="business-media-blocks"
      data-layout={layout}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {blocks.map((block) => {
        if (block.type === 'image') {
          return (
            <img
              key={block.assetId}
              src={businessMediaUrl(block.contentPath)}
              alt={block.title}
              className="max-h-80 w-full rounded-2xl bg-[#0c0b0a] object-contain"
              data-testid="business-media-image"
            />
          );
        }
        if (block.type === 'video') {
          return (
            <video
              key={block.assetId}
              src={block.href}
              controls
              playsInline
              preload="metadata"
              className="max-h-80 w-full rounded-2xl bg-[#0c0b0a]"
              data-testid="business-media-video"
              aria-label={block.title}
            />
          );
        }
        if (block.type === 'map') {
          const href = `https://www.openstreetmap.org/?mlat=${encodeURIComponent(block.latitude)}&mlon=${encodeURIComponent(block.longitude)}#map=16/${encodeURIComponent(block.latitude)}/${encodeURIComponent(block.longitude)}`;
          return (
            <a
              key={block.assetId}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-2xl border border-[#e8d5b5]/25 px-4 py-3 text-sm text-[#f5ead8]"
              data-testid="business-media-map"
            >
              <span className="block font-medium">{block.title}</span>
              {block.caption ? <span className="mt-1 block text-[#c9bba8]">{block.caption}</span> : null}
              <span className="mt-2 block text-xs text-[#a89880]">Haritada aç</span>
            </a>
          );
        }
        return (
          <a
            key={block.assetId}
            href={block.href}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-2xl border border-[#e8d5b5]/25 px-4 py-3 text-sm text-[#f5ead8] underline-offset-4 hover:underline"
            data-testid="business-media-link"
          >
            <span className="block font-medium">{block.title}</span>
            {block.caption ? <span className="mt-1 block text-[#c9bba8] no-underline">{block.caption}</span> : null}
          </a>
        );
      })}
    </div>
  );
}
