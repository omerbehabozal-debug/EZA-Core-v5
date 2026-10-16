"use client";
import { useEffect, useState } from 'react';
import { getApiUrl } from '@/lib/apiUrl';
import type { BusinessPublisher } from '@/lib/eza/mirror/journey/publicFrozenTypes';
export default function BusinessPublicProfile({ params }: { params: { slug: string } }) {
  const [profile,setProfile]=useState<BusinessPublisher|null>(null),[error,setError]=useState('');
  useEffect(() => { const controller=new AbortController(); fetch(getApiUrl().replace(/\/$/, '')+'/api/business-yansi/public/'+encodeURIComponent(params.slug),{cache:'no-store',signal:controller.signal}).then(async r=>{if(!r.ok)throw new Error('Business profili bulunamadı.');setProfile(await r.json());}).catch(e=>{if(e.name!=='AbortError')setError(e.message);}); return ()=>controller.abort(); },[params.slug]);
  return <main className="p-8 text-[#f4f0e8]">{error && <p role="alert">{error}</p>}{profile ? <><h1>{profile.displayName}</h1><p>{profile.official ? 'Resmî BiligN' : 'Doğrulanmış Business'}</p></> : !error && <p>Yükleniyor…</p>}</main>;
}
