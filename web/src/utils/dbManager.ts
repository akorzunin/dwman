import dayjs from 'dayjs';
import {
  ApiError,
  ApiService,
  CreateUser,
  UpdateUser,
  User,
} from '../api/client';

export const getLocation = () => {
  const pref = window.location.href.split('//')[0];
  const location = window.location.href.split('//')[1].split('/')[0];
  return [pref, location];
};

export const getUserDataApi = async (userId: string): Promise<User> => {
  const res = await ApiService.getUserApiUserGet(userId);
  return res;
};

export const createUser = async (userData: CreateUser): Promise<User> => {
  return await ApiService.createUserApiNewUserPost(userData);
};

export const getOrCreateUser = async (userId: string) => {
  if (!userId) {
    return null;
  }
  try {
    const userData = await getUserDataApi(userId);
    return userData;
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 404) {
        const res = await createUser({
          user_id: userId,
          is_premium: false,
          refresh_token: '',
        });
        return res;
      }
    }
    console.error(error);
  }
  return null;
};

export const updateUserDataV2 = async (
  userId: string,
  updateUser: UpdateUser
): Promise<User | null> => {
  try {
    const res = await ApiService.updateUserApiUpdateUserPut(userId, updateUser);
    return res;
  } catch (error) {
    if (error instanceof ApiError) {
      return null;
    }
    console.error(error);
    throw new Error('Unknown error');
  }
};

export const weekDays = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] as const;
export type singleWeekDay = (typeof weekDays)[number];
/**
 * parse time and weekday to iso fromatted string
 */
export function parseFormTime(time: string, weekday: singleWeekDay): string {
  const dayNum = weekDays.indexOf(weekday);
  const [hour, minute] = time.split(':', 2);
  // first day of year is Monday
  const t = dayjs('1973-01-01T00:00+00:00')
    .day(dayNum + 1)
    .hour(Number(hour))
    .minute(Number(minute));

  return t.toISOString();
}

export function parseUserSaveTime(time: string): string {
  const t = dayjs(time);
  const hour = t.hour().toString().padStart(2, '0');
  const minute = t.minute().toString().padStart(2, '0');
  return `${hour}:${minute}`;
}

export function parseUserWeekDay(
  time: string | undefined
): singleWeekDay | false {
  const t = dayjs(time);
  if (t.isValid() === false) {
    return false;
  }
  const dayNum = t.day();
  return weekDays[dayNum - 1];
}
