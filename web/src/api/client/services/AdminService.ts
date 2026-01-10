/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { Message } from '../models/Message';
import type { User } from '../models/User';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class AdminService {
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
