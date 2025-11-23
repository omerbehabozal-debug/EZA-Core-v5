/**
 * EmptyState Component - Apple Style Welcome Screen
 */

export default function EmptyState() {
  return (
    <div className="flex items-center justify-center h-full px-4 animate-fade-in">
      <div className="text-center max-w-sm">
        {/* Blur Card */}
        <div className="backdrop-blur-xl bg-white/60 rounded-3xl p-8 shadow-lg border border-gray-200/50">
          {/* Mini EZA Logo */}
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 mx-auto mb-6 flex items-center justify-center shadow-md">
            <span className="text-3xl text-white font-bold">EZA</span>
          </div>
          
          {/* Welcome Message */}
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Merhaba
          </h2>
          <p className="text-gray-600 text-[15px] leading-relaxed">
            Yardımcı olmak için hazırım.
          </p>
        </div>
      </div>
    </div>
  );
}

