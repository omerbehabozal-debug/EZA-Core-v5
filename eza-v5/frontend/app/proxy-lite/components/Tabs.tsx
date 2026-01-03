/**
 * Tabs Component - Apple Soft Light Theme
 */

'use client';

import React, { useState, createContext, useContext } from 'react';
import { cn } from '@/lib/utils';

interface TabsProps {
  children: React.ReactNode;
  defaultTab?: string;
}

interface TabContextType {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const TabContext = createContext<TabContextType | null>(null);

export default function Tabs({ children, defaultTab = 'general' }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab);

  return (
    <TabContext.Provider value={{ activeTab, setActiveTab }}>
      <div className="w-full">{children}</div>
    </TabContext.Provider>
  );
}

export function TabList({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-1 sm:gap-2 border-b overflow-x-auto" style={{ borderColor: '#E3E3E7' }}>
      {children}
    </div>
  );
}

export function Tab({ value, children }: { value: string; children: React.ReactNode }) {
  const context = useContext(TabContext);
  if (!context) throw new Error('Tab must be used within Tabs');

  const isActive = context.activeTab === value;

  return (
    <button
      type="button"
      onClick={() => context.setActiveTab(value)}
      className={cn(
        'px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 md:py-3 text-xs sm:text-sm font-medium transition-colors border-b-2 whitespace-nowrap touch-manipulation',
        isActive
          ? 'text-[#007AFF] border-[#007AFF]'
          : 'text-[#6E6E73] border-transparent'
      )}
      style={{ fontFamily: 'Inter, system-ui, -apple-system, sans-serif', fontWeight: 500 }}
    >
      {children}
    </button>
  );
}

export function TabPanel({ value, children }: { value: string; children: React.ReactNode }) {
  const context = useContext(TabContext);
  if (!context) throw new Error('TabPanel must be used within Tabs');

  if (context.activeTab !== value) return null;

  return <div className="mt-4 sm:mt-6">{children}</div>;
}
