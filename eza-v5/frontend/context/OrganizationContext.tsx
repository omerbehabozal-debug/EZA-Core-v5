/**
 * Organization Context
 * Multi-tenant organization state management
 */

'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface Organization {
  id: string;
  name: string;
  plan: 'free' | 'pro' | 'enterprise';
  status: 'active' | 'suspended';
  proxy_access: boolean;
  base_currency: 'TRY' | 'USD';
  sla_tier?: string;
  default_policy_set?: string;
  created_at: string;
}

interface OrganizationContextType {
  currentOrganization: Organization | null;
  organizations: Organization[];
  setCurrentOrganization: (org: Organization | null) => void;
  loadOrganizations: () => Promise<void>;
  createOrganization: (org: Partial<Organization>) => Promise<Organization | null>;
  updateOrganization: (orgId: string, updates: Partial<Organization>) => Promise<boolean>;
  suspendOrganization: (orgId: string) => Promise<boolean>;
  isLoading: boolean;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

const ORG_STORAGE_KEY = 'eza_current_org';
const ORGS_STORAGE_KEY = 'eza_organizations';

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const [currentOrganization, setCurrentOrganizationState] = useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load current organization from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(ORG_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          setCurrentOrganizationState(parsed);
        }
      } catch (error) {
        console.error('Failed to load organization from localStorage:', error);
      }
    }
  }, []);

  // Load organizations from API
  const loadOrganizations = async () => {
    setIsLoading(true);
    try {
      const API_BASE_URL = process.env.NEXT_PUBLIC_EZA_API_URL || 'http://localhost:8000';
      
      // Get token from eza_auth storage
      let token: string | null = null;
      const authStorage = localStorage.getItem('eza_auth');
      if (authStorage) {
        try {
          const auth = JSON.parse(authStorage);
          token = auth.token;
        } catch {
          // Fallback to old storage key
          token = localStorage.getItem('auth_token');
        }
      } else {
        token = localStorage.getItem('auth_token');
      }
      
      const apiKey = localStorage.getItem('proxy_api_key');

      const res = await fetch(`${API_BASE_URL}/api/platform/organizations`, {
        headers: {
          'Authorization': `Bearer ${token || ''}`,
          'X-Api-Key': apiKey || '',
        },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.organizations) {
          setOrganizations(data.organizations);
          
          // If no current org selected, select first one
          if (!currentOrganization && data.organizations.length > 0) {
            setCurrentOrganization(data.organizations[0]);
          }
        } else {
          // No organizations found - user needs to create one
          setOrganizations([]);
        }
      } else {
        // API failed - don't use fallback, let user create organization
        setOrganizations([]);
      }
    } catch (error) {
      console.error('Failed to load organizations:', error);
      // Don't use fallback - let user create organization
      setOrganizations([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Set current organization and persist to localStorage
  const setCurrentOrganization = (org: Organization | null) => {
    setCurrentOrganizationState(org);
    
    if (typeof window !== 'undefined') {
      try {
        if (org) {
          localStorage.setItem(ORG_STORAGE_KEY, JSON.stringify(org));
        } else {
          localStorage.removeItem(ORG_STORAGE_KEY);
        }
      } catch (error) {
        console.error('Failed to save organization to localStorage:', error);
      }
    }

    // Trigger reload of all components that depend on organization
    window.dispatchEvent(new CustomEvent('organization-changed', { detail: org }));
  };

  // Create new organization
  const createOrganization = async (orgData: Partial<Organization>): Promise<Organization | null> => {
    try {
      const API_BASE_URL = process.env.NEXT_PUBLIC_EZA_API_URL || 'http://localhost:8000';
      
      // Get token from eza_auth storage
      let token: string | null = null;
      const authStorage = localStorage.getItem('eza_auth');
      if (authStorage) {
        try {
          const auth = JSON.parse(authStorage);
          token = auth.token;
        } catch {
          token = localStorage.getItem('auth_token');
        }
      } else {
        token = localStorage.getItem('auth_token');
      }
      
      const apiKey = localStorage.getItem('proxy_api_key') || 'dev-key';

      const res = await fetch(`${API_BASE_URL}/api/platform/organizations`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token || ''}`,
          'X-Api-Key': apiKey || '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orgData),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.organization) {
          const newOrg = data.organization;
          setOrganizations([...organizations, newOrg]);
          setCurrentOrganization(newOrg);
          return newOrg;
        }
      }
      return null;
    } catch (error) {
      console.error('Failed to create organization:', error);
      return null;
    }
  };

  // Update organization
  const updateOrganization = async (orgId: string, updates: Partial<Organization>): Promise<boolean> => {
    try {
      const API_BASE_URL = process.env.NEXT_PUBLIC_EZA_API_URL || 'http://localhost:8000';
      
      // Get token from eza_auth storage
      let token: string | null = null;
      const authStorage = localStorage.getItem('eza_auth');
      if (authStorage) {
        try {
          const auth = JSON.parse(authStorage);
          token = auth.token;
        } catch {
          token = localStorage.getItem('auth_token');
        }
      } else {
        token = localStorage.getItem('auth_token');
      }
      
      const apiKey = localStorage.getItem('proxy_api_key');

      const res = await fetch(`${API_BASE_URL}/api/platform/organizations/${orgId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token || ''}`,
          'X-Api-Key': apiKey || '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.organization) {
          const updated = data.organization;
          setOrganizations(organizations.map(org => org.id === orgId ? updated : org));
          
          // Update current org if it's the one being updated
          if (currentOrganization?.id === orgId) {
            setCurrentOrganization(updated);
          }
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Failed to update organization:', error);
      return false;
    }
  };

  // Suspend organization
  const suspendOrganization = async (orgId: string): Promise<boolean> => {
    return updateOrganization(orgId, { status: 'suspended' });
  };

  // Load organizations on mount
  useEffect(() => {
    loadOrganizations();
  }, []);

  const value: OrganizationContextType = {
    currentOrganization,
    organizations,
    setCurrentOrganization,
    loadOrganizations,
    createOrganization,
    updateOrganization,
    suspendOrganization,
    isLoading,
  };

  return <OrganizationContext.Provider value={value}>{children}</OrganizationContext.Provider>;
}

/**
 * Hook to use organization context
 */
export function useOrganization(): OrganizationContextType {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
}

