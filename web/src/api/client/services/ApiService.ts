/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreateUser } from '../models/CreateUser';
import type { RefreshToken } from '../models/RefreshToken';
import type { SpotifyError } from '../models/SpotifyError';
import type { SpotifyToken } from '../models/SpotifyToken';
import type { User } from '../models/User';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class ApiService {
  /**
   * Refresh Token
   * @param requestBody
   * @returns any Successful Response
   * @throws ApiError
   */
  public static refreshTokenApiRefreshTokenPost(
    requestBody: RefreshToken
  ): CancelablePromise<SpotifyToken | SpotifyError> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/api/refresh_token',
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        422: `Validation Error`,
      },
    });
  }
  /**
   * Create User
   * Create new user
   * @param requestBody
   * @returns User Successful Response
   * @throws ApiError
   */
  public static createUserApiNewUserPost(
    requestBody: CreateUser
  ): CancelablePromise<User> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/api/new_user',
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        400: `Bad Request`,
        422: `Validation Error`,
      },
    });
  }
}
