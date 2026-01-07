// TODO : add auth store
// import { atom } from 'jotai';
// import { SpotifyCookie } from '../interfaces/Cookies';
import { atomWithStorage } from 'jotai/utils';

export const accessTokenAtom = atomWithStorage('access_token', '');
export const authExpiresAtom = atomWithStorage('expires_in', '');
export const refreshTokenAtom = atomWithStorage('refresh_token', '');

// export const getAccesToken = () => {
//   second;
// };

// export const authAtom = atom<SpotifyCookie>({
//   access_token: string,
//   token_type: string,
//   expires_in: number,
//   refresh_token: string,
//   scope: string,
// });
