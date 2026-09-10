import { create } from 'zustand';
import type { SainaConversationItem } from '@/components/saina/SainaConversationSidebar';
import type { ConversationTreeGroupNode } from '@/lib/eza/conversation-tree/types';
import type { SainaNotificationItem } from '@/components/saina/SainaNotificationsDropdown';
import type { SainaPlanTier } from '@/lib/eza/plan/sainaPlanTier';
import { DEFAULT_ANALYSIS_MODEL_ID } from '@/lib/standaloneModels';
import type { SainaAppView } from '@/lib/eza/sainaRoutes';

export type SainaChromeState = {
  activeSection: SainaAppView;
  conversations: SainaConversationItem[];
  conversationGroups?: ConversationTreeGroupNode[];
  activeChatId: string | null;
  conversationSceneUrl?: string | null;
  /** Optional crop focal (0–1); omitted → CSS center. */
  conversationSceneFocalX?: number | null;
  conversationSceneFocalY?: number | null;
  planTier?: SainaPlanTier;
  onNewChat?: () => void;
  onSelectChat?: (id: string) => void;
  onDeleteChat?: (id: string) => void;
  onRenameGroup?: (id: string, title: string) => void | Promise<void>;
  onDeleteGroup?: (id: string) => void | Promise<void>;
  onOpenPattern?: () => void;
  onUpgrade?: () => void;
  onRequestLogin?: () => void;
  safeOnlyMode: boolean;
  onSafeOnlyModeChange: (enabled: boolean) => void;
  analysisModelId: string;
  onAnalysisModelChange: (modelId: string) => void;
  settingsDisabled?: boolean;
  onOpenMirror?: () => void;
  /** System, mirror, and pattern updates for the notification center. */
  notifications?: SainaNotificationItem[];
  openMobileSidebar?: () => void;
  openCommandPalette?: () => void;
};

type SainaChromeStore = SainaChromeState & {
  setChrome: (patch: Partial<SainaChromeState>) => void;
};

const initialChrome: SainaChromeState = {
  activeSection: 'chat',
  conversations: [],
  activeChatId: null,
  conversationSceneUrl: null,
  conversationSceneFocalX: null,
  conversationSceneFocalY: null,
  safeOnlyMode: false,
  analysisModelId: DEFAULT_ANALYSIS_MODEL_ID,
  onSafeOnlyModeChange: () => {},
  onAnalysisModelChange: () => {},
};

export const useSainaChromeStore = create<SainaChromeStore>((set, get) => ({
  ...initialChrome,
  setChrome: (patch) => {
    const current = get();
    const keys = Object.keys(patch) as Array<keyof SainaChromeState>;
    const changed = keys.some((key) => current[key] !== patch[key]);
    if (!changed) return;
    set((state) => ({ ...state, ...patch }));
  },
}));
