'use client';

import React from 'react';
import { HelpCircle } from 'lucide-react';
import { useHelp } from '@/contexts/HelpContext';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface HelpIconProps {
  section: string;
  tooltip?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
};

export function HelpIcon({
  section,
  tooltip = 'Click for help',
  className,
  size = 'sm',
}: HelpIconProps) {
  const { openHelp } = useHelp();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              openHelp(section);
            }}
            className={cn(
              'inline-flex items-center justify-center rounded-full',
              'text-muted-foreground hover:text-foreground',
              'hover:bg-accent transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
              'p-0.5',
              className
            )}
            type="button"
            aria-label={tooltip}
          >
            <HelpCircle className={sizeClasses[size]} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-xs">{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
