import { ApiService } from '../api/client';
import dayjs from 'dayjs';
import { readCookies } from './cookieHandle';

export const ISO_FORMAT = 'YYYY-MM-DDTHH:mm:ss.SSSZ';

export const getAccessToken = async (): Promise<string> => {
  const accessToken = localStorage.getItem('access_token');
  if (isSpotifyTokenValid() && accessToken) {
    return accessToken;
  }
  let refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken || refreshToken === 'undefined') {
    refreshToken = readCookies()[0].refresh_token;
    if (!refreshToken) {
      throw new Error('No refresh_token found');
    }
  }
  const tokenObj = await getNewAccessToken(refreshToken);
  localStorage.setItem('access_token', tokenObj.access_token);
  localStorage.setItem(
    'expired_at',
    setTokenExpirationDate(tokenObj.expires_in)
  );
  if (!localStorage.getItem('refresh_token')) {
    localStorage.setItem('refresh_token', refreshToken);
  }
  return tokenObj.access_token;
};

export const getNewAccessToken = async (refreshToken: string) => {
  const res = await ApiService.refreshTokenApiRefreshTokenPost({
    refresh_token: refreshToken,
  });
  console.info('refreshing access_token');
  return res;
};

export function isSpotifyTokenValid(): boolean {
  const expiredAt = localStorage.getItem('expired_at');
  if (!expiredAt) {
    return false;
  }
  const expirationTime = dayjs(expiredAt);
  const currentTime = dayjs();

  return expirationTime.isAfter(currentTime);
}
export function setTokenExpirationDate(expires_in: number): string {
  const currentTime = dayjs();
  const expiredAt = currentTime.add(expires_in, 'second').format(ISO_FORMAT);
  localStorage.setItem('expired_at', expiredAt);
  return expiredAt;
}
