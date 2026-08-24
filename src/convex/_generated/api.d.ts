/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as attendance from "../attendance.js";
import type * as audit from "../audit.js";
import type * as auth from "../auth.js";
import type * as auth_emailOtp from "../auth/emailOtp.js";
import type * as bootstrap from "../bootstrap.js";
import type * as drivers from "../drivers.js";
import type * as guard from "../guard.js";
import type * as http from "../http.js";
import type * as parents from "../parents.js";
import type * as routes from "../routes.js";
import type * as services from "../services.js";
import type * as students from "../students.js";
import type * as users from "../users.js";
import type * as vehicles from "../vehicles.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  attendance: typeof attendance;
  audit: typeof audit;
  auth: typeof auth;
  "auth/emailOtp": typeof auth_emailOtp;
  bootstrap: typeof bootstrap;
  drivers: typeof drivers;
  guard: typeof guard;
  http: typeof http;
  parents: typeof parents;
  routes: typeof routes;
  services: typeof services;
  students: typeof students;
  users: typeof users;
  vehicles: typeof vehicles;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
