'use client';

import {
  contentNatureLabel,
  experienceTypeLabel,
  type YansiContentNature,
  type YansiExperienceType,
} from '@/lib/eza/mirror/journey/yansiContentIdentity';

export default function YansiContentIdentityLine({
  experienceType,
  contentNature,
  testId = 'yansi-content-identity',
}: {
  experienceType?: YansiExperienceType | null;
  contentNature?: YansiContentNature | null;
  testId?: string;
}) {
  const typeLabel = experienceTypeLabel(experienceType);
  const natureLabel = contentNatureLabel(contentNature);
  if (!typeLabel && !natureLabel) return null;
  return (
    <p
      className="mt-0.5 text-[10px] font-normal normal-case tracking-normal text-[rgba(217,196,163,0.72)]"
      data-testid={testId}
      data-experience-type={experienceType || undefined}
      data-content-nature={contentNature || undefined}
    >
      {typeLabel}
      {typeLabel && natureLabel ? <span aria-hidden="true"> · </span> : null}
      {natureLabel}
    </p>
  );
}
