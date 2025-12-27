/**
 * RTÜK Pilot Notice Component
 * 
 * Expectation management banner explaining pilot status and scope.
 * Informational tone only - no warning colors.
 */

'use client';

export function RTUKPilotNotice() {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded p-6 mt-8">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">
        Pilot Uygulama ve Kapsam Notu
      </h3>
      <div className="text-sm text-gray-700 leading-relaxed space-y-3">
        <p>
          Bu panel, RTÜK için geliştirilen bir pilot gözetim ekranıdır.
        </p>
        <p>
          Şu anda gösterilen veriler,
          sınırlı sayıda medya organizasyonunun
          EZA etik analiz altyapısı üzerinden üretilmiş gözlem kayıtlarına dayanmaktadır.
        </p>
        <p>
          Altyapıya daha fazla medya kuruluşu ve yapay zekâ sistemi dahil oldukça,
          bu panelin temsil gücü ve davranış desenleri doğal olarak genişleyecektir.
        </p>
        <p>
          Bu durum bir eksiklik değil,
          altyapının kademeli ve kontrollü ölçeklenme yaklaşımının sonucudur.
        </p>
      </div>
    </div>
  );
}

