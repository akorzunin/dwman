/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type SpotifyToken = {
  access_token: string;
  token_type: SpotifyToken.token_type;
  expires_in: number;
};
export namespace SpotifyToken {
  export enum token_type {
    BEARER = 'Bearer',
  }
}
