/**
 * Tenant Color Utilities
 */

import { TenantConfig } from './tenant';
import { cn } from './utils';

const colorClassMap: Record<string, Record<string, string>> = {
  red: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
    borderActive: 'border-red-600',
    textActive: 'text-red-600',
  },
  blue: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    borderActive: 'border-blue-600',
    textActive: 'text-blue-600',
  },
  indigo: {
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    border: 'border-indigo-200',
    borderActive: 'border-indigo-600',
    textActive: 'text-indigo-600',
  },
  green: {
    bg: 'bg-green-50',
    text: 'text-green-700',
    border: 'border-green-200',
    borderActive: 'border-green-600',
    textActive: 'text-green-600',
  },
  purple: {
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    borderActive: 'border-purple-600',
    textActive: 'text-purple-600',
  },
};

export function getTenantColorClasses(tenant: TenantConfig, isActive: boolean = false) {
  const colors = colorClassMap[tenant.primaryColor] || colorClassMap.blue;
  
  if (isActive) {
    return cn(colors.bg, colors.text, colors.border);
  }
  
  return {
    bg: colors.bg,
    text: colors.text,
    border: colors.border,
    borderActive: colors.borderActive,
    textActive: colors.textActive,
  };
}

export function getTenantTabClasses(tenant: TenantConfig, isActive: boolean) {
  const colors = colorClassMap[tenant.primaryColor] || colorClassMap.blue;
  
  if (isActive) {
    return cn(colors.borderActive, colors.textActive);
  }
  
  return 'border-transparent text-gray-600 hover:text-gray-900';
}

