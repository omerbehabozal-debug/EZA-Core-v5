/**
 * OutputCompare Component - Side-by-side comparison of raw vs safe output
 */

interface OutputCompareProps {
  rawOutput?: string;
  safeOutput?: string;
}

export default function OutputCompare({ rawOutput, safeOutput }: OutputCompareProps) {
  if (!rawOutput && !safeOutput) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <p className="text-sm text-gray-500 text-center py-8">
          Analiz sonuçlarını görmek için bir mesaj gönderin.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Çıktı Karşılaştırması</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Raw Output */}
        <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-700">Ham Model Cevabı</h3>
            <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full">
              Raw
            </span>
          </div>
          <div className="text-sm text-gray-800 whitespace-pre-wrap break-words max-h-96 overflow-y-auto">
            {rawOutput || 'N/A'}
          </div>
        </div>

        {/* Safe Output */}
        <div className="border border-gray-200 rounded-xl p-4 bg-green-50/30">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-700">EZA Safe Cevap</h3>
            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
              Safe
            </span>
          </div>
          <div className="text-sm text-gray-800 whitespace-pre-wrap break-words max-h-96 overflow-y-auto">
            {safeOutput || 'N/A'}
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-500 mt-4 text-center">
        Bu panel sadece EZA AR-GE ekibine açıktır.
      </p>
    </div>
  );
}

