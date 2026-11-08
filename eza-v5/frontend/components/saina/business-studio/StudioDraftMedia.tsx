'use client';

import { useEffect, useState } from 'react';
import BusinessMediaBlocks from '@/components/mirror-landing/BusinessMediaBlocks';
import { fetchBrandAssetPreview } from '@/lib/eza/businessYansi';
import type { PublicBusinessBlock } from '@/lib/eza/mirror/journey/businessMedia';
import { AuthorizedVideo } from './CoverPreparation';

export type DraftPreviewBlock = PublicBusinessBlock | {
  type: 'image' | 'video';
  assetId: string;
  title: string;
  authenticated: true;
} | { type: 'image'; assetId: string; title: string; externalImageUrl: string };

function StudioDraftImage({ businessId, assetId, title }: {
  businessId: string; assetId: string; title: string;
}) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let active = true;
    let url = '';
    fetchBrandAssetPreview(businessId, assetId).then((next) => {
      if (!active) {
        URL.revokeObjectURL?.(next);
        return;
      }
      url = next;
      setSrc(next);
    }).catch(() => {
      if (active) setSrc('');
    });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL?.(url);
    };
  }, [businessId, assetId]);

  return src
    ? <BusinessMediaBlocks blocks={[{ type: 'image', assetId, title, contentPath: '' }]} imageSrc={src} layout="desktop" />
    : <span className="biz-studio-evidence-meta">{title}</span>;
}

export function StudioDraftMedia({ businessId, blocks }: { businessId: string; blocks: DraftPreviewBlock[] }) {
  return blocks.map((block) => {
    const key = businessId + ':' + block.assetId;
    if ('externalImageUrl' in block) {
      return <BusinessMediaBlocks key={key} blocks={[{ type: 'image', assetId: block.assetId, title: block.title, contentPath: '' }]} imageSrc={block.externalImageUrl} layout="desktop" />;
    }
    if (!('authenticated' in block)) {
      return <BusinessMediaBlocks key={key} blocks={[block]} layout="desktop" />;
    }
    if (block.type === 'video') {
      return <AuthorizedVideo key={key} businessId={businessId} assetId={block.assetId} label={block.title} />;
    }
    return <StudioDraftImage key={key} businessId={businessId} assetId={block.assetId} title={block.title} />;
  });
}
