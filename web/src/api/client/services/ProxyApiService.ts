/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class ProxyApiService {
  /**
   * Spotify Request
   * @param path
   * @returns any Successful Response
   * @throws ApiError
   */
  public static spotifyRequestApiSpotifyPathGet(
    path: string
  ): CancelablePromise<any> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/api/spotify/{path}',
      path: {
        path: path,
      },
      errors: {
        422: `Validation Error`,
      },
    });
  }
  /**
   * Spotify Request
   * @param path
   * @returns any Successful Response
   * @throws ApiError
   */
  public static spotifyRequestApiSpotifyPathGet1(
    path: string
  ): CancelablePromise<any> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/api/spotify/{path}',
      path: {
        path: path,
      },
      errors: {
        422: `Validation Error`,
      },
    });
  }
}
