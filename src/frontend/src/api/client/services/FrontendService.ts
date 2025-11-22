/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class FrontendService {
  /**
   * Root
   * @returns any Successful Response
   * @throws ApiError
   */
  public static rootGet(): CancelablePromise<any> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/',
    });
  }
  /**
   * Favicon
   * @returns any Successful Response
   * @throws ApiError
   */
  public static faviconFaviconIcoGet(): CancelablePromise<any> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/favicon.ico',
    });
  }
  /**
   * React Path
   * @returns any Successful Response
   * @throws ApiError
   */
  public static reactPathAppGet(): CancelablePromise<any> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/app/{_}',
    });
  }
  /**
   * User Page
   * Redirect to react hash router user page
   * @param userId
   * @returns void
   * @throws ApiError
   */
  public static userPageUserUserIdGet(userId: string): CancelablePromise<void> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/user/{user_id}',
      path: {
        user_id: userId,
      },
      errors: {
        300: `Successful Response`,
        422: `Validation Error`,
      },
    });
  }
  /**
   * Login Url
   * Redirect to Spotify login page
   * @param state
   * @param showDialog
   * @returns void
   * @throws ApiError
   */
  public static loginUrlLoginGet(
    state: string = 'Gx)KS)!w(d>`|~#I',
    showDialog: 'true' | 'false' = 'false'
  ): CancelablePromise<void> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/login',
      query: {
        state: state,
        show_dialog: showDialog,
      },
      errors: {
        300: `Successful Response`,
        422: `Validation Error`,
      },
    });
  }
  /**
   * Login Redirect
   * @param region
   * @returns void
   * @throws ApiError
   */
  public static loginRedirectRegionLoginGet(
    region: string
  ): CancelablePromise<void> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/{region}/login',
      path: {
        region: region,
      },
      errors: {
        300: `Successful Response`,
        422: `Validation Error`,
      },
    });
  }
  /**
   * Get Token
   * @param code
   * @param redirect
   * @returns void
   * @throws ApiError
   */
  public static getTokenGetTokenGet(
    code: string,
    redirect: boolean = true
  ): CancelablePromise<void> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/get_token',
      query: {
        code: code,
        redirect: redirect,
      },
      errors: {
        300: `Successful Response`,
        422: `Validation Error`,
      },
    });
  }
}
