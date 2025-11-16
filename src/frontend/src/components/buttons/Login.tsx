import { Link } from 'react-router';
import { Button } from '../../shadcn/ui/button';
import { Settings } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@radix-ui/react-dialog';
import { DialogDescription } from '../../shadcn/ui/dialog';
import { useState } from 'react';
import { getUserPath } from '../../utils/cookieHandle';

export const Login = ({ basePath }: { basePath: string }) => {
  const [refreshToken, setRefreshToken] = useState('');

  return (
    <div className="flex gap-0.5">
      <Button asChild>
        <Link
          reloadDocument
          to={`${basePath}/login`}
          className="rounded-none rounded-l-md"
        >
          Login
        </Link>
      </Button>
      <Dialog>
        <DialogTrigger className="rounded-none rounded-r-md bg-primary px-2">
          <Settings className="h-5 w-5" />
        </DialogTrigger>
        <DialogContent className="">
          <DialogTitle className="sr-only">Use refresh token</DialogTitle>
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
              className="w-full rounded-md bg-background px-3 py-2 text-sm"
            />
          </DialogDescription>
        </DialogContent>
      </Dialog>
    </div>
  );
};
