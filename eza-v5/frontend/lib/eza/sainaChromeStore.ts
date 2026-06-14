import { create } from 'zustand';
import type { SainaConversationItem } from '@/components/saina/SainaConversationSidebar';
import type { SainaNotificationItem } from '@/components/saina/SainaNotificationsDropdown';
import type { SainaPlanTier } from '@/lib/eza/plan/sainaPlanTier';
import { DEFAULT_ANALYSIS_MODEL_ID } from '@/lib/standaloneModels';
import type { SainaAppView } from '@/lib/eza/sainaRoutes';

export type SainaChromeState = {
  activeSection: SainaAppView;
  conversations: SainaConversationItem[];
  activeChatId: string | null;
  planTier?: SainaPlanTier;
  onNewChat?: () => void;
  onSelectChat?: (id: string) => void;
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
  safeOnlyMode: false,
  analysisModelId: DEFAULT_ANALYSIS_MODEL_ID,
  onSafeOnlyModeChange: () => {},
  onAnalysisModelChange: () => {},
};

export const useSainaChromeStore = create<SainaChromeStore>((set) => ({
  ...initialChrome,
  setChrome: (patch) => set((state) => ({ ...state, ...patch })),
}));
