"use client";

import { useChatStore, EngineMode } from "@/stores/chatStore";

const modes: { value: EngineMode; label: string; glow?: string }[] = [
  { value: "standalone", label: "Standalone" },
  { value: "proxy", label: "Proxy", glow: "yellow-glow" },
  { value: "fast", label: "Fast" },
  { value: "deep", label: "Deep", glow: "blue-glow" },
  { value: "openai", label: "OpenAI" },
];

export default function ModeSwitcher() {
  const engineMode = useChatStore((s) => s.engineMode);
  const setEngineMode = useChatStore((s) => s.setEngineMode);
  const reset = useChatStore((s) => s.reset);

  return (
    <div className="flex items-center gap-1 glass rounded-full p-1">
      {modes.map((mode) => {
        const isActive = engineMode === mode.value;
        return (
          <button
            key={mode.value}
            onClick={() => {
              setEngineMode(mode.value);
              reset();
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
              isActive
                ? `bg-accent text-bg shadow-accent-glow ${
                    mode.glow ? `shadow-${mode.glow}` : ""
                  }`
                : "text-text-dim hover:text-text hover:bg-panel/30"
            }`}
          >
            {mode.label}
          </button>
        );
      })}
    </div>
  );
}

