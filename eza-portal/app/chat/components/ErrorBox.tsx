"use client";

interface ErrorBoxProps {
  message: string;
  onDismiss?: () => void;
}

export default function ErrorBox({ message, onDismiss }: ErrorBoxProps) {
  return (
    <div className="glass rounded-xl p-4 border border-danger/30 bg-danger/10 animate-slide-in">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-danger text-lg">⚠</span>
            <h3 className="text-sm font-semibold text-danger">Hata</h3>
          </div>
          <p className="text-xs text-text-dim">{message}</p>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-text-dim hover:text-text transition"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

