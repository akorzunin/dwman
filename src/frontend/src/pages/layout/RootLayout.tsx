import { Link, Outlet, useParams } from 'react-router';
import Footer from '../../components/Footer';
import { Button } from '../../shadcn/ui/button';
import { ModeToggle } from '../../shadcn/ui/theme-toggle';
import { OpenAPI } from '../../api/client';
import UserCard from '../../components/UserCard';
import { useAtomValue } from 'jotai';
import { CurrentSongAtom } from '../../store/store';
import BurgerMenu from '../../components/menu/BurgerMenu';
import HeaderSongCard from '../../components/HeaderSongCard';

export function RootLayout() {
  const { userId } = useParams();
  const CurrentSong = useAtomValue(CurrentSongAtom);

  return (
    <div className="container relative flex h-screen flex-col justify-between">
      <header className="flex p-4">
        {userId ? (
          <div className="flex w-full items-center justify-between">
            <UserCard />
            <HeaderSongCard song={CurrentSong} isAddable={true} />
            <div className="gap-x-3 desktop:hidden">
              <BurgerMenu userId={userId} />
            </div>
            <div className="hidden gap-x-3 desktop:flex">
              <Button asChild>
                <Link to="/app/">Home</Link>
              </Button>
              <Button asChild>
                <Link to="/app/help">Help</Link>
              </Button>
              <Button variant="destructive" asChild>
                <Link to={'/app/'}>Logout</Link>
              </Button>
              <ModeToggle />
            </div>
          </div>
        ) : (
          <div className="flex w-full items-center justify-between">
            <div className="text-6xl font-bold text-primary-foreground">
              <Link to="/app/">DWMan</Link>
            </div>
            <div className="flex gap-x-3 tablet:hidden">
              <Button asChild>
                <Link reloadDocument to={`${OpenAPI.BASE}/login`}>
                  Login
                </Link>
              </Button>
              <BurgerMenu userId={userId} />
            </div>
            <div className="hidden gap-x-3 tablet:flex">
              <Button asChild>
                <Link to="/app/user/demo_user">Layout Demo</Link>
              </Button>
              <Button asChild>
                <Link to="/app/help">Help</Link>
              </Button>
              <Button asChild>
                <Link reloadDocument to={`${OpenAPI.BASE}/login`}>
                  Login
                </Link>
              </Button>
              <ModeToggle />
            </div>
          </div>
        )}
      </header>
      <main>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
