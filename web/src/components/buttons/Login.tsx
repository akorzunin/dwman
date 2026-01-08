import { Link } from 'react-router';
import { Button } from '../../shadcn/ui/button';
import { Ellipsis, Settings } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '../../shadcn/ui/dialog';
import { useState } from 'react';
import { getUserPath } from '../../utils/cookieHandle';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '../../shadcn/ui/dropdown-menu';

export const Login = ({ basePath }: { basePath: string }) => {
  const [refreshToken, setRefreshToken] = useState('');

  return (
    <div className="flex gap-0.5">
      <Dialog>
        <Button asChild>
          <Link
            reloadDocument
            to={`${basePath}/login`}
            className="rounded-none rounded-l-md"
          >
            Login
          </Link>
        </Button>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger className="rounded-none rounded-r-md bg-primary px-2">
            <Ellipsis className="h-5 w-5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={16} className="w-56 p-2">
            <DialogTrigger className="rounded-none rounded-r-md bg-primary px-2">
              <Button>Use refresh token</Button>
            </DialogTrigger>
          </DropdownMenuContent>
        </DropdownMenu>
        <DialogContent>
          <DialogTitle>Login with refresh token</DialogTitle>
          <DialogDescription>
            <input
              value={refreshToken}
              onChange={(e) => setRefreshToken(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                if (!refreshToken) return;
                localStorage.setItem('refresh_token', refreshToken);
                const p = await getUserPath();
                window.location.href = p;
              }}
              type="text"
              placeholder="Paste refresh token here"
              className="w-full rounded-md border-2 border-solid border-secondary bg-background px-3 py-2 text-sm text-primary-foreground"
            />
          </DialogDescription>
        </DialogContent>
      </Dialog>
    </div>
  );
};
