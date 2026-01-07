/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class DocsService {
  /**
   * Get Documentation
   * @returns any Successful Response
   * @throws ApiError
   */
  public static getDocumentationDocsGet(): CancelablePromise<any> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/docs',
    });
  }
  /**
   * Get Open Api Endpoint
   * @returns any Successful Response
   * @throws ApiError
   */
  public static getOpenApiEndpointOpenapiJsonGet(): CancelablePromise<any> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/openapi.json',
    });
  }
}
