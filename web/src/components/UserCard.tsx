import { useQuery } from '@tanstack/react-query';
import { useAtom } from 'jotai/react';
import { FC } from 'react';
import { useParams } from 'react-router';
import { Avatar, AvatarFallback, AvatarImage } from '../shadcn/ui/avatar';
import { UserDataAtom } from '../store/store';
import { getUserData } from '../utils/apiManager';
import { getOrCreateUser } from '../utils/dbManager';
import { formatFollowerNumber } from '../utils/utils';
import { WeekCounter } from './WeekCounter';

const UserCard: FC = () => {
  const { userId } = useParams();
  const [, setDbUserData] = useAtom(UserDataAtom);
  const { data: user } = useQuery({
    queryKey: ['user', userId],
    queryFn: async () => {
      // user data from Spotify api
      const userData = await getUserData();
      try {
        const dbUserData = await getOrCreateUser(userData.id);
        if (dbUserData) setDbUserData(dbUserData);
      } catch (error) {
        console.error(error);
      }
      return userData;
    },
    enabled: !!userId,
  });
  return (
    <div className="flex items-center gap-4 p-2">
      {/* all user pictures can be only 64x64 */}
      <Avatar className="h-[64px] w-[64px]">
        <AvatarImage src={user?.img} className="h-full" />
        <AvatarFallback>NA</AvatarFallback>
      </Avatar>
      <div>
        <div className="text-shadow-md mr-6 text-lg font-semibold leading-6 text-primary-foreground">
          {user?.name}
        </div>
        <div className="text-primary-foreground opacity-80">
          {formatFollowerNumber(user?.followers || 0)} followers
        </div>
        <WeekCounter />
      </div>
    </div>
  );
};

export default UserCard;
