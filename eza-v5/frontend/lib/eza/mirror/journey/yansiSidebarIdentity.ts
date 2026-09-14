/**
 * Stable Yansı sidebar + route identity.
 * Aligns with server preparation source_identity: `{journeyId}::v{version}`.
 */

export const YANSI_ROUTE_PARAM = 'yansi';
export const YANSI_SIDEBAR_ID_PREFIX = 'yansi::';

export type YansiArtifactIdentity = {
  journeyId: string;
  journeyVersion: number;
};

export type YansiSidebarIdentity = YansiArtifactIdentity & {
  sourceConversationId: string;
};

/** Server/source_identity form — also used as ?yansi= value. */
export function buildYansiSourceIdentity(
  journeyId: string,
  journeyVersion: number
): string {
  const jid = journeyId.trim().toLowerCase();
  const version = Number(journeyVersion);
  if (!jid || !Number.isFinite(version) || version < 1) return '';
  return `${jid}::v${version}`;
}

export function parseYansiSourceIdentity(
  raw: string | null | undefined
): YansiArtifactIdentity | null {
  const value = (raw || '').trim().toLowerCase();
  if (!value) return null;
  const match = /^([a-z0-9][a-z0-9._-]*)::v(\d+)$/i.exec(value);
  if (!match) return null;
  const journeyId = match[1]!.trim().toLowerCase();
  const journeyVersion = Number(match[2]);
  if (!journeyId || !Number.isFinite(journeyVersion) || journeyVersion < 1) {
    return null;
  }
  return { journeyId, journeyVersion };
}

/** Globally unique sidebar row id — never equals a conversationId. */
export function buildYansiSidebarItemId(input: YansiSidebarIdentity): string {
  const conv = input.sourceConversationId.trim();
  const source = buildYansiSourceIdentity(input.journeyId, input.journeyVersion);
  if (!conv || !source) return '';
  return `${YANSI_SIDEBAR_ID_PREFIX}${conv}::${source}`;
}

export function parseYansiSidebarItemId(
  raw: string | null | undefined
): YansiSidebarIdentity | null {
  const value = (raw || '').trim();
  if (!value.startsWith(YANSI_SIDEBAR_ID_PREFIX)) return null;
  const rest = value.slice(YANSI_SIDEBAR_ID_PREFIX.length);
  const parts = rest.split('::');
  // convId :: journeyId :: vN  — journeyId itself must not contain ::
  if (parts.length < 3) return null;
  const versionPart = parts[parts.length - 1]!;
  const journeyId = parts[parts.length - 2]!;
  const sourceConversationId = parts.slice(0, -2).join('::');
  const parsed = parseYansiSourceIdentity(`${journeyId}::${versionPart}`);
  if (!parsed || !sourceConversationId.trim()) return null;
  return {
    sourceConversationId: sourceConversationId.trim(),
    journeyId: parsed.journeyId,
    journeyVersion: parsed.journeyVersion,
  };
}

export function encodeYansiRouteParam(
  journeyId: string,
  journeyVersion: number
): string {
  return buildYansiSourceIdentity(journeyId, journeyVersion);
}

export function parseYansiRouteParam(
  raw: string | null | undefined
): YansiArtifactIdentity | null {
  return parseYansiSourceIdentity(raw);
}

export function buildStandaloneYansiHref(input: {
  sourceConversationId: string;
  journeyId: string;
  journeyVersion: number;
}): string {
  const chat = input.sourceConversationId.trim();
  const yansi = encodeYansiRouteParam(input.journeyId, input.journeyVersion);
  if (!chat || !yansi) return '/standalone';
  const params = new URLSearchParams();
  params.set('chat', chat);
  params.set(YANSI_ROUTE_PARAM, yansi);
  return `/standalone?${params.toString()}`;
}

export function artifactMatchesYansiIdentity(
  artifact: {
    journeyId?: string | null;
    journeyVersion?: number | null;
  },
  identity: YansiArtifactIdentity | null | undefined
): boolean {
  if (!identity) return false;
  const jid = (artifact.journeyId || '').trim().toLowerCase();
  const version = Number(artifact.journeyVersion);
  return jid === identity.journeyId && version === identity.journeyVersion;
}
