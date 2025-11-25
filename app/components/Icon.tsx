"use client";

import * as Icons from "lucide-react";
import { LucideIcon } from "lucide-react";

interface IconProps {
  name: string;
  className?: string;
  size?: number;
}

export default function Icon({ name, className = "", size = 24 }: IconProps) {
  // Icon isimlerini normalize et (PascalCase)
  const normalizedName = name as keyof typeof Icons;
  const IconComponent = Icons[normalizedName] as LucideIcon | undefined;
  
  if (!IconComponent) {
    // Development'ta console'a uyarı ver
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      console.warn(`Icon "${name}" not found in lucide-react`);
    }
    return null;
  }
  
  return <IconComponent className={className} size={size} />;
}
