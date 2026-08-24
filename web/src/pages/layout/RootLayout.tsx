import { useAtomValue } from 'jotai';
import { Link, Outlet, useParams } from 'react-router';
import { OpenAPI } from '../../api/client';
import { Login } from '../../components/buttons/Login';
import Footer from '../../components/Footer';
import BurgerMenu from '../../components/menu/BurgerMenu';
import HeaderSongCard from '../../components/songs/HeaderSongCard';
import UserCard from '../../components/UserCard';
import { Button } from '../../shadcn/ui/button';
import { ModeToggle } from '../../shadcn/ui/theme-toggle';
import { CurrentSongAtom } from '../../store/store';

export function RootLayout() {
  const { userId } = useParams();
  const CurrentSong = useAtomValue(CurrentSongAtom);

  return (
    <div className="container relative flex h-screen flex-col px-2 laptop:justify-between laptop:px-4">
      <div>
        <header className="flex py-4">
          {userId ? (
            <div className="w-full items-center justify-between desktop:flex">
              <div className="flex w-full items-center justify-between">
                <UserCard />
                <BurgerMenu userId={userId} className="desktop:hidden" />
              </div>
              <div className="laptop:flex laptop:w-full laptop:justify-center desktop:block">
                <HeaderSongCard song={CurrentSong} isAddable={true} />
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
                <Login basePath={OpenAPI.BASE} />
                <BurgerMenu userId={userId} />
              </div>
              <div className="hidden gap-x-3 tablet:flex">
                <Button asChild>
                  <Link to="/app/user/demo_user">Layout Demo</Link>
                </Button>
                <Button asChild>
                  <Link to="/app/help">Help</Link>
                </Button>
                <Login basePath={OpenAPI.BASE} />
                <ModeToggle />
              </div>
            </div>
          )}
        </header>
        <main>
          <Outlet />
        </main>
      </div>
      <Footer />
    </div>
  );
}
