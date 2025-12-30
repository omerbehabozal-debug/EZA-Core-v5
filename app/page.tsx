"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import Hero from "./components/Hero";
import Section from "./components/Section";
import TabbedEcosystem from "./components/TabbedEcosystem";
import SectorGrid from "./components/SectorGrid";
import VisionSection from "./components/VisionSection";
import WhyEZA from "./components/WhyEZA";
import EZAPosition from "./components/EZAPosition";
import FAQ from "./components/FAQ";
import EZACoreIntro from "./components/EZACoreIntro";
import DemoShowcase from "./components/DemoShowcase";

export default function Home() {
  const pathname = usePathname();
  const router = useRouter();
  const scrollRestored = useRef(false);
  const isRestoring = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const previousPathnameRef = useRef<string | null>(null);
  const ecosystemSectionRef = useRef<HTMLElement | null>(null);

  // Scroll pozisyonunu restore et (sayfa render olmadan önce)
  useLayoutEffect(() => {
    if (typeof window !== 'undefined' && pathname === '/') {
      const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const isBackForward = navEntry?.type === 'back_forward';
      const isReload = navEntry?.type === 'reload';

      // Sayfa yenilenince scroll pozisyonunu temizle ve sayfa başından başla
      if (isReload) {
        sessionStorage.removeItem('homeScrollPosition');
        sessionStorage.removeItem('homeScrollSection');
        scrollRestored.current = false;
        isRestoring.current = false;
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
        previousPathnameRef.current = pathname;
        return;
      }

      // Geri dönüş kontrolü: Eğer önceki pathname '/' değilse ve şimdi '/' ise, geri dönüş demektir
      const prevPath = previousPathnameRef.current;
      const isReturningToHome = prevPath !== null && prevPath !== '/' && pathname === '/';

      // Sadece geri/ileri butonu ile dönünce scroll pozisyonunu restore et
      if ((isBackForward || isReturningToHome) && !scrollRestored.current) {
        const savedPosition = sessionStorage.getItem('homeScrollPosition');
        const savedSection = sessionStorage.getItem('homeScrollSection');
        
        if (savedPosition !== null) {
          scrollRestored.current = true;
          isRestoring.current = true;
          
          const position = parseInt(savedPosition, 10);
          if (!isNaN(position) && position >= 0) {
            // Sayfa render olmadan önce scroll pozisyonunu restore et
            // Eğer EZA Ekosistemi bölümü kaydedilmişse, o bölümün başına scroll et
            window.scrollTo(0, position);
            document.documentElement.scrollTop = position;
            document.body.scrollTop = position;
          }
        }
      } else if (!isBackForward && !isReload && !isReturningToHome) {
        // İlk yükleme veya doğrudan navigasyon (home link hariç)
        const savedPosition = sessionStorage.getItem('homeScrollPosition');
        if (savedPosition === null) {
          // Home link'e tıklanmış veya ilk yükleme
          scrollRestored.current = false;
          isRestoring.current = false;
        } else {
          // Normal navigasyon, scroll pozisyonunu koru
          scrollRestored.current = false;
          isRestoring.current = false;
        }
      }
    }
  }, [pathname]);

      // EZA Ekosistemi bölümünün pozisyonunu ilk yüklemede hesapla ve hash değişimini dinle
  useEffect(() => {
    if (typeof window !== 'undefined' && pathname === '/') {
      const element = document.getElementById('ecosystem');
      if (element) {
        ecosystemSectionRef.current = element;
      }

      // Hash değişimini dinle (#ecosystem geldiğinde scroll et)
      const handleHashChange = () => {
        if (window.location.hash === '#ecosystem') {
          const ecosystemElement = document.getElementById('ecosystem');
          if (ecosystemElement) {
            const rect = ecosystemElement.getBoundingClientRect();
            const position = window.scrollY + rect.top;
            
            // EZA Ekosistemi bölümünün pozisyonunu kaydet
            sessionStorage.setItem('homeScrollPosition', position.toString());
            sessionStorage.setItem('homeScrollSection', 'ecosystem');
            
            // Bölüme scroll et
            setTimeout(() => {
              window.scrollTo({
                top: position,
                behavior: 'smooth'
              });
            }, 100);
          }
        }
      };

      // İlk yüklemede hash kontrolü
      if (window.location.hash === '#ecosystem') {
        handleHashChange();
      }

      // Hash değişimini dinle
      window.addEventListener('hashchange', handleHashChange);
      
      return () => {
        window.removeEventListener('hashchange', handleHashChange);
      };
    }
  }, [pathname]);

  // Pathname değişimini izle ve scroll pozisyonunu kaydet
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const prevPath = previousPathnameRef.current;
      
      // Anasayfaya dönüş kontrolü
      if (prevPath !== '/' && pathname === '/') {
        // EZA Ekosistemine Dön butonuna tıklanmış mı kontrol et
        const savedSection = sessionStorage.getItem('homeScrollSection');
        if (savedSection === 'ecosystem') {
          // EZA Ekosistemi bölümünün pozisyonunu hesapla ve scroll et
          setTimeout(() => {
            const ecosystemElement = document.getElementById('ecosystem');
            if (ecosystemElement) {
              const rect = ecosystemElement.getBoundingClientRect();
              const position = window.scrollY + rect.top;
              
              // Pozisyonu kaydet
              sessionStorage.setItem('homeScrollPosition', position.toString());
              
              // Bölüme scroll et
              window.scrollTo({
                top: position,
                behavior: 'smooth'
              });
            }
          }, 100);
        }
      }
      
      // Anasayfadan ayrılırken scroll pozisyonunu kaydet
      if (prevPath === '/' && pathname !== '/') {
        const ecosystemPosition = (() => {
          const element = document.getElementById('ecosystem');
          if (element) {
            const rect = element.getBoundingClientRect();
            return window.scrollY + rect.top;
          }
          return null;
        })();
        
        const currentScroll = window.scrollY;
        
        // Eğer EZA Ekosistemi bölümüne gelmişse, o bölümün başlangıç pozisyonunu kaydet
        if (ecosystemPosition !== null && currentScroll >= ecosystemPosition) {
          sessionStorage.setItem('homeScrollPosition', ecosystemPosition.toString());
          sessionStorage.setItem('homeScrollSection', 'ecosystem');
        } else if (currentScroll > 0) {
          // Eğer EZA Ekosistemi bölümüne gelmemişse, normal scroll pozisyonunu kaydet
          sessionStorage.setItem('homeScrollPosition', currentScroll.toString());
          sessionStorage.removeItem('homeScrollSection');
        }
      }
      
      // Pathname'i güncelle
      previousPathnameRef.current = pathname;
    }
  }, [pathname]);

  // Scroll pozisyonunu kaydet ve restore işlemini tamamla
  useEffect(() => {
    if (typeof window !== 'undefined' && pathname === '/') {
      // Navigation type kontrolü
      const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const isBackForward = navEntry?.type === 'back_forward';

      // EZA Ekosistemi bölümünün başlangıç pozisyonunu bul
      const getEcosystemSectionPosition = () => {
        if (!ecosystemSectionRef.current) {
          const element = document.getElementById('ecosystem');
          if (element) {
            ecosystemSectionRef.current = element;
          }
        }
        if (ecosystemSectionRef.current) {
          const rect = ecosystemSectionRef.current.getBoundingClientRect();
          return window.scrollY + rect.top;
        }
        return null;
      };

      // Scroll pozisyonunu kaydetme fonksiyonu
      // Eğer EZA Ekosistemi bölümüne gelmişse, o bölümün başlangıç pozisyonunu kaydet
      const saveScrollPosition = () => {
        if (!isRestoring.current) {
          const ecosystemPosition = getEcosystemSectionPosition();
          const currentScroll = window.scrollY;
          
          // Eğer EZA Ekosistemi bölümüne gelmişse (scroll pozisyonu bölümün başlangıcından büyük veya eşitse)
          // o bölümün başlangıç pozisyonunu kaydet
          if (ecosystemPosition !== null && currentScroll >= ecosystemPosition) {
            sessionStorage.setItem('homeScrollPosition', ecosystemPosition.toString());
            sessionStorage.setItem('homeScrollSection', 'ecosystem');
          } else {
            // Eğer EZA Ekosistemi bölümüne gelmemişse, normal scroll pozisyonunu kaydet
            sessionStorage.setItem('homeScrollPosition', currentScroll.toString());
            sessionStorage.removeItem('homeScrollSection');
          }
        }
      };

      if (isBackForward && isRestoring.current) {
        // Restore işlemini tamamla
        const savedPosition = sessionStorage.getItem('homeScrollPosition');
        if (savedPosition !== null) {
          const position = parseInt(savedPosition, 10);
          if (!isNaN(position) && position >= 0) {
            // Ekstra güvence için birkaç frame sonra tekrar kontrol et
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                if (window.scrollY !== position) {
                  window.scrollTo(0, position);
                }
                isRestoring.current = false;
              });
            });
          } else {
            isRestoring.current = false;
          }
        }
      } else if (!isBackForward) {
        // İlk yükleme veya doğrudan navigasyon
        const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        const isReload = navEntry?.type === 'reload';
        
        if (!isReload) {
          // Reload durumunda zaten useLayoutEffect'te temizlendi
          scrollRestored.current = false;
          isRestoring.current = false;
        }
      }

      // Scroll pozisyonunu throttled olarak kaydet (sadece anasayfada)
      const handleScroll = () => {
        if (!isRestoring.current) {
          if (scrollTimeoutRef.current) {
            clearTimeout(scrollTimeoutRef.current);
          }
          scrollTimeoutRef.current = setTimeout(() => {
            saveScrollPosition();
          }, 150);
        }
      };

      // Sayfadan ayrılırken scroll pozisyonunu kaydet
      const handleBeforeUnload = () => {
        saveScrollPosition();
      };

      // Visibility change (tab değişimi) sırasında da kaydet
      const handleVisibilityChange = () => {
        if (!document.hidden) {
          saveScrollPosition();
        }
      };

      // Sayfa değişimini yakalamak için popstate event'i
      const handlePopState = () => {
        // Geri/ileri butonu kullanıldığında scroll pozisyonunu kaydet
        saveScrollPosition();
      };

      window.addEventListener('scroll', handleScroll, { passive: true });
      window.addEventListener('beforeunload', handleBeforeUnload);
      window.addEventListener('popstate', handlePopState);
      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      return () => {
        window.removeEventListener('scroll', handleScroll);
        window.removeEventListener('beforeunload', handleBeforeUnload);
        window.removeEventListener('popstate', handlePopState);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
        }
        // Component unmount olurken scroll pozisyonunu kaydet (sadece anasayfadan ayrılırken)
        if (pathname === '/') {
          saveScrollPosition();
        }
      };
    }
  }, [pathname]);

  return (
    <>
      {/* Section 1: Hero - EZA Felsefesi ve İlk İzlenim */}
      <Hero 
        showVideo={true}
        videoSrc="/videos/ce313605-5baa-49e2-b91f-951898ff530e_watermark.mp4"
        videoType="video/mp4"
      />

      {/* Section 2: EZA Nedir? */}
      <Section id="about" className="bg-white">
        <VisionSection />
      </Section>

      {/* Section 3: Neden EZA? - Sorun ve Çözüm */}
      <Section id="why-eza" className="bg-eza-gray">
        <WhyEZA />
      </Section>

      {/* Section 4: EZA-Core - Teknolojik Motor (Vision ve WhyEZA'dan sonra mantıklı) */}
      <Section className="bg-white">
        <EZACoreIntro />
      </Section>

      {/* Section 4.5: Premium Demo Videos - EZA-Core'un Nasıl Çalıştığını Göster */}
      <Section className="bg-eza-gray">
        <DemoShowcase />
      </Section>

      {/* Section 5: Ecosystem - Nasıl Çalışıyor, Detaylar */}
      <Section id="ecosystem" className="bg-eza-gray">
        <div className="max-w-7xl mx-auto">
          <TabbedEcosystem />
        </div>
      </Section>

      {/* Section 6: Sector Solutions - Compact Grid */}
      <Section id="solutions" className="bg-white">
        <div className="max-w-7xl mx-auto">
          <SectorGrid />
        </div>
      </Section>

      {/* Section 7: EZA'nın Duruşu */}
      <Section id="position" className="bg-white">
        <EZAPosition />
      </Section>

      {/* Section 8: FAQ */}
      <Section id="faq" className="bg-eza-gray">
        <FAQ />
      </Section>
    </>
  );
}
