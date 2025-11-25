import * as Icons from "lucide-react";
import { LucideIcon } from "lucide-react";

interface IconProps {
  name: string;
  className?: string;
  size?: number;
}

export default function Icon({ name, className = "", size = 24 }: IconProps) {
  const IconComponent = Icons[name as keyof typeof Icons] as LucideIcon;
  
  if (!IconComponent) {
    return null;
  }
  
  return <IconComponent className={className} size={size} />;
}

