/**
 * Tabs Component for EZA Proxy
 */

"use client";

import React, { ReactNode } from "react";

interface TabsProps {
  children: ReactNode;
  defaultTab?: string;
  onTabChange?: (tab: string) => void;
}

interface TabContextType {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function Tabs({ children, defaultTab = "analiz", onTabChange }: TabsProps) {
  const [activeTab, setActiveTab] = React.useState(defaultTab);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  return (
    <div className="space-y-4">
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child, { activeTab, setActiveTab: handleTabChange } as any);
        }
        return child;
      })}
    </div>
  );
}

export function TabList({ children, activeTab, setActiveTab }: { children: ReactNode; activeTab: string; setActiveTab: (tab: string) => void }) {
  return (
    <div className="flex gap-2 border-b" style={{ borderColor: '#2C2C2E' }}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child, { activeTab, setActiveTab } as any);
        }
        return child;
      })}
    </div>
  );
}

export function Tab({ id, children, activeTab, setActiveTab }: { id: string; children: ReactNode; activeTab: string; setActiveTab: (tab: string) => void }) {
  const isActive = activeTab === id;
  
  return (
    <button
      type="button"
      onClick={() => setActiveTab(id)}
      className="px-4 py-3 text-sm font-medium transition-colors"
      style={{
        color: isActive ? '#007AFF' : '#8E8E93',
        borderBottom: isActive ? '2px solid #007AFF' : '2px solid transparent',
      }}
    >
      {children}
    </button>
  );
}

export function TabPanel({ id, children, activeTab }: { id: string; children: ReactNode; activeTab: string }) {
  if (activeTab !== id) return null;
  return <div>{children}</div>;
}

