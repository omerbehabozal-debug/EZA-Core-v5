/**
 * Tabs Component for General Result and Paragraph Analysis
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
    <div className="flex gap-2 border-b" style={{ borderColor: '#1A1F2E' }}>
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
        'px-6 py-3 text-sm font-medium transition-colors border-b-2',
        isActive
          ? 'text-[#0066FF] border-[#0066FF]'
          : 'text-gray-400 border-transparent hover:text-gray-300'
      )}
    >
      {children}
    </button>
  );
}

export function TabPanel({ value, children }: { value: string; children: React.ReactNode }) {
  const context = useContext(TabContext);
  if (!context) throw new Error('TabPanel must be used within Tabs');

  if (context.activeTab !== value) return null;

  return <div className="mt-6">{children}</div>;
}

