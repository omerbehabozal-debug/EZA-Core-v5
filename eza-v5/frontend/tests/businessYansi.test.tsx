import '@testing-library/jest-dom/vitest';
import { render,screen,fireEvent,waitFor } from '@testing-library/react';
import { beforeEach,describe,it,expect,vi } from 'vitest';
import SainaBusinessManager from '@/components/saina/SainaBusinessManager';
import { parsePublicFrozenJourneyArtifact } from '@/lib/eza/mirror/journey/publicFrozenTypes';
const api=vi.hoisted(()=>vi.fn());
vi.mock('@/lib/eza/businessYansi',()=>({businessRequest:api}));
const business={id:'business-a',name:'BiligN',slug:'bilign',description:'Verified information',verified:true,official:true,status:'active'};
beforeEach(()=>{api.mockReset();api.mockImplementation(async(path='')=>path===''?{items:[business],canProvision:false}:path.endsWith('/overview')?{business,role:'viewer',publications:[]}:{items:[]});});
describe('Business management',()=>{
 it('keeps management scoped and hides write controls from viewer',async()=>{render(<SainaBusinessManager/>);await screen.findByText('BiligN',{selector:'h2'});fireEvent.click(screen.getByRole('button',{name:'Bilgi Havuzu'}));expect(screen.queryByRole('button',{name:'Taslak sürüm kaydet'})).not.toBeInTheDocument();expect(api).toHaveBeenCalledWith('/business-a/knowledge');});
 it('shows backend errors and does not invent authorized content',async()=>{api.mockRejectedValue(new Error('business_access_denied'));render(<SainaBusinessManager/>);expect(await screen.findByRole('alert')).toHaveTextContent('business_access_denied');expect(screen.queryByRole('button',{name:'Yansı Stüdyosu'})).not.toBeInTheDocument();});
 it('provides eight sourced editorial steps to editor',async()=>{api.mockImplementation(async(path='')=>path===''?{items:[business],canProvision:false}:path.endsWith('/overview')?{business,role:'editor',publications:[]}:{items:[]});render(<SainaBusinessManager/>);await screen.findByText('BiligN',{selector:'h2'});fireEvent.click(screen.getByRole('button',{name:'Yansı Stüdyosu'}));expect(screen.getAllByRole('combobox').length).toBe(9);expect(screen.getByLabelText('8. soru')).toBeVisible();expect(screen.queryByRole('button',{name:'Onayla'})).not.toBeInTheDocument();});
});
describe('Business public identity',()=>{
 it('accepts explicit verified business identity and drops private extras',()=>{const raw={slug:'source',journeyVersion:1,authorUserId:'business-id',selectedCount:8,replayReady:true,sourceConversationId:'private-source',businessPublisher:{businessId:'business-id',slug:'bilign',displayName:'BiligN',verified:true,official:true,ownerId:'private-owner'},steps:Array.from({length:8},(_,i)=>({stepIndex:i+1,publicQuestion:'Question',publicAnswer:'Answer',ezaSnapshot:{userScore:88}}))};const parsed=parsePublicFrozenJourneyArtifact(raw);expect(parsed?.businessPublisher?.official).toBe(true);expect(JSON.stringify(parsed)).not.toMatch(/private-source|private-owner|ezaSnapshot/);});
});
