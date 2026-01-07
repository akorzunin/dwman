export interface SpotifyCookie {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}
export const SpotifyCookieKeys = [
  'access_token',
  'token_type',
  'expires_in',
  'refresh_token',
  'scope',
] as const;
