/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CreateUser } from '../models/CreateUser';
import type { Message } from '../models/Message';
import type { RefreshToken } from '../models/RefreshToken';
import type { SpotifyError } from '../models/SpotifyError';
import type { SpotifyToken } from '../models/SpotifyToken';
import type { UpdateUser } from '../models/UpdateUser';
import type { User } from '../models/User';
import type { UserEmail } from '../models/UserEmail';
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
   * Send Mail
   * Send mail to user
   * @param requestBody
   * @returns any Successful Response
   * @throws ApiError
   */
  public static sendMailApiSendMailPost(
    requestBody: UserEmail
  ): CancelablePromise<any> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/api/send_mail',
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        422: `Validation Error`,
      },
    });
  }
  /**
   * Test Save Email
   * Test save email
   * @param requestBody
   * @returns any Successful Response
   * @throws ApiError
   */
  public static testSaveEmailApiTestSaveEmailPost(
    requestBody: UserEmail
  ): CancelablePromise<any> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/api/test_save_email',
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        422: `Validation Error`,
      },
    });
  }
  /**
   * Get Users
   * Get all users from database
   * @returns User Successful Response
   * @throws ApiError
   */
  public static getUsersApiUsersGet(): CancelablePromise<Array<User>> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/api/users',
    });
  }
  /**
   * Get User
   * Get user by user_id
   * @param userId
   * @returns any Successful Response
   * @throws ApiError
   */
  public static getUserApiUserGet(userId: string): CancelablePromise<any> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/api/user',
      query: {
        user_id: userId,
      },
      errors: {
        404: `Not Found`,
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
  /**
   * Update User
   * Update user
   * @param userId
   * @param requestBody
   * @returns User Successful Response
   * @throws ApiError
   */
  public static updateUserApiUpdateUserPut(
    userId: string,
    requestBody: UpdateUser
  ): CancelablePromise<User> {
    return __request(OpenAPI, {
      method: 'PUT',
      url: '/api/update_user',
      query: {
        user_id: userId,
      },
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        404: `Not Found`,
        422: `Validation Error`,
      },
    });
  }
  /**
   * Delete User
   * Delete user by id
   * @param userId
   * @returns Message Successful Response
   * @throws ApiError
   */
  public static deleteUserApiDeleteUserDelete(
    userId: string
  ): CancelablePromise<Message> {
    return __request(OpenAPI, {
      method: 'DELETE',
      url: '/api/delete_user',
      query: {
        user_id: userId,
      },
      errors: {
        422: `Validation Error`,
      },
    });
  }
  /**
   * Force Notifications Task
   * Send notifications task
   * @param weekday
   * @param hour
   * @returns any Successful Response
   * @throws ApiError
   */
  public static forceNotificationsTaskApiForceNotificationsTaskPost(
    weekday?: '0' | '1' | '2' | '3' | '4' | '5' | '6' | null,
    hour?: number | null
  ): CancelablePromise<any> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/api/force_notifications_task',
      query: {
        weekday: weekday,
        hour: hour,
      },
      errors: {
        422: `Validation Error`,
      },
    });
  }
}
