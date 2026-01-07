import { Palette } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu';
import { ThemeList, useTheme } from './theme-provider';
import { Button } from './button';
import { cn } from '../../lib/utils';

export function ModeToggle({ className }: { className?: string }) {
  const { setTheme } = useTheme();

  return (
    <div className={cn('contents', className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon">
            <Palette className="absolute h-[1.2rem] w-[1.2rem]" />
            <span className="sr-only">Toggle theme</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={5}>
          {ThemeList.map(({ label, value }) => (
            <DropdownMenuItem key={value} onClick={() => setTheme(value)}>
              {label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem onClick={() => setTheme('system')}>
            System
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
