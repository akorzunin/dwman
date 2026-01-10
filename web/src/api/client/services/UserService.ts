/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { UpdateUser } from '../models/UpdateUser';
import type { User } from '../models/User';
import type { UserEmail } from '../models/UserEmail';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class UserService {
  /**
   * Test Notification
   * Test save email
   * @param requestBody
   * @returns any Successful Response
   * @throws ApiError
   */
  public static testNotificationApiTestNotificationPost(
    requestBody: UserEmail
  ): CancelablePromise<any> {
    return __request(OpenAPI, {
      method: 'POST',
      url: '/api/test-notification',
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        422: `Validation Error`,
      },
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
}
