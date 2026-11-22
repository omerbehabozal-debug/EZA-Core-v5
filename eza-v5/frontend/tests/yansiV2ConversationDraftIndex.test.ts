import { beforeEach, describe, expect, it } from 'vitest';
import {
  readConversationDraftIndex,
  removeConversationDraftIndex,
  upsertConversationDraftIndex,
  isConversationDraftEditable,
  isConversationDraftLocked,
} from '@/lib/eza/yansiV2ConversationDraftIndex';

const BIZ = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const OTHER = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

describe('yansiV2ConversationDraftIndex', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('stores and filters rows by business', () => {
    upsertConversationDraftIndex(BIZ, {
      id: 'd1',
      businessId: BIZ,
      title: 'Bir',
      status: 'draft',
      revision: 1,
    });
    upsertConversationDraftIndex(BIZ, {
      id: 'd2',
      businessId: OTHER,
      title: 'Yabancı',
      status: 'draft',
      revision: 1,
    });
    const rows = readConversationDraftIndex(BIZ);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('d1');
  });

  it('updates existing row and supports remove', () => {
    upsertConversationDraftIndex(BIZ, {
      id: 'd1',
      businessId: BIZ,
      title: 'Eski',
      status: 'draft',
      revision: 1,
    });
    upsertConversationDraftIndex(BIZ, {
      id: 'd1',
      businessId: BIZ,
      title: 'Yeni',
      status: 'review',
      revision: 2,
    });
    expect(readConversationDraftIndex(BIZ)[0]).toMatchObject({
      title: 'Yeni',
      status: 'review',
      revision: 2,
    });
    removeConversationDraftIndex(BIZ, 'd1');
    expect(readConversationDraftIndex(BIZ)).toHaveLength(0);
  });

  it('marks published drafts as locked; approved stays publishable', () => {
    expect(isConversationDraftEditable('draft')).toBe(true);
    expect(isConversationDraftEditable('review')).toBe(true);
    expect(isConversationDraftEditable('approved')).toBe(false);
    expect(isConversationDraftLocked('approved')).toBe(false);
    expect(isConversationDraftLocked('published')).toBe(true);
    expect(isConversationDraftLocked('draft', 'node')).toBe(true);
  });
});
