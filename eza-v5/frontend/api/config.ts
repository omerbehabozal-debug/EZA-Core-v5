/**
 * API Configuration
 */

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_EZA_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL || 
  process.env.NEXT_PUBLIC_API_URL || 
  "https://eza-core-v5-production.up.railway.app";

