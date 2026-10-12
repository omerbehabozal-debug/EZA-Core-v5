import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMirrorSohbetSession, personalChatStartError, cacheSohbetSession } from '@/lib/eza/mirror-network/createSohbetSession';
import { startMirrorGuestChat } from '@/lib/eza/mirror-network/mirrorGuestConversation';
import { getChatArchive, clearMirrorAutoReplyPending } from '@/lib/standaloneChatArchive';
import type { MirrorSohbetSession } from '@/lib/eza/mirror-network/sohbetTypes';
const session: MirrorSohbetSession = {sessionId:'trial',guestTrialSessionId:'trial',guestToken:'guest-token-long-enough',mirrorSlug:'source',
 cardTitle:'Source',openingMessage:'Open',thoughtCards:[],expiresAt:'2030-01-01',parentMirrorId:'source',rootMirrorId:'source',seedTopic:'',seedCategory:'',seedMood:'',guestTrialMessages:[]};
beforeEach(()=>{ localStorage.clear();sessionStorage.clear();vi.restoreAllMocks(); });
describe('Guest trial handoff',()=>{
 it('checks backend ownership and quota even for a cached legacy guest session',async()=>{
  cacheSohbetSession({...session,guestTrialSessionId:undefined});
  const fetchMock=vi.fn().mockResolvedValue({ok:false,status:403,json:async()=>({detail:{reason:'guest_discover_limit_reached'}})});
  vi.stubGlobal('fetch',fetchMock);
  const result=await createMirrorSohbetSession('source');
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(result).toMatchObject({ok:false,reason:'guest_discover_limit_reached'});
 });
 it.each(['guest_discover_limit_reached','guest_token_required','guest_trial_session_invalid'])('classifies 403 reason %s',async(reason)=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,status:403,json:async()=>({detail:{reason}})}));
  const result=await createMirrorSohbetSession('source',{forceNew:true});
  expect(result.ok).toBe(false);if(result.ok)throw new Error('Unexpected success');
  expect(Boolean(result.quotaDetail)).toBe(reason==='guest_discover_limit_reached');
  expect(personalChatStartError(result)).toContain(reason==='guest_discover_limit_reached'?'hakkını kullandın':'Misafir oturumun doğrulanamadı');
 });
 it.each([401,429,500,502])('classifies HTTP %s without quota',status=>{
  const message=personalChatStartError({status});
  expect(message).not.toContain('hakkını kullandın');expect(message).toContain('Mesajın korundu');
 });
 it('uses stable chat and retains failed first draft on retry',()=>{
  const first=startMirrorGuestChat({session,firstUserMessage:'İlk soru'})!;
  const retry=startMirrorGuestChat({session,firstUserMessage:'Yeni taslak'})!;
  expect(first.chatId).toBe(retry.chatId);
  expect(getChatArchive(first.chatId)?.mirrorOrigin?.pendingUserMessage).toBe('İlk soru');
 });
 it('reopens completed conversation with server turns and queues a new question',()=>{
  const first=startMirrorGuestChat({session,firstUserMessage:'İlk soru'})!;clearMirrorAutoReplyPending(first.chatId);
  const resumed=startMirrorGuestChat({session:{...session,guestTrialResumed:true,guestTrialMessages:[{id:'u',text:'İlk soru',isUser:true},{id:'a',text:'Yanıt',isUser:false}]},firstUserMessage:'Devam sorusu'})!;
  expect(resumed.chatId).toBe(first.chatId);
  expect(getChatArchive(first.chatId)?.messages).toHaveLength(2);
  expect(resumed.mirrorOrigin.pendingUserMessage).toBe('Devam sorusu');
  expect(resumed.mirrorOrigin.pendingUserMessageId).toBeUndefined();
 });
 it('rejects a switched guest identity for an existing local trial',()=>{
  startMirrorGuestChat({session,firstUserMessage:'Soru'});
  expect(startMirrorGuestChat({session:{...session,guestToken:'different-guest-token'},firstUserMessage:'Soru'})).toBeNull();
 });
 it('maps ten-message exhaustion explicitly',()=>{
  expect(personalChatStartError({status:403,reason:'guest_message_limit_reached'})).toContain('10 mesajlık misafir deneme hakkını tamamladın');
 });
});
