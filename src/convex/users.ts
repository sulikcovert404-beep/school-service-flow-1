import { getAuthUserId } from "@convex-dev/auth/server";
import { query, QueryCtx } from "./_generated/server";

/**
 * Public auth configuration for the sign-in page. Guest (anonymous) login is a
 * demo convenience: it is DISABLED in production by setting ENABLE_GUEST_LOGIN
 * to "false" in the Keys/API-keys tab. Defaults to enabled for the preview env.
 */
export const getAuthConfig = query({
  args: {},
  handler: async () => {
    return {
      guestLoginEnabled: process.env.ENABLE_GUEST_LOGIN !== "false",
    };
  },
});

/**
 * Get the current signed in user. Returns null if the user is not signed in.
 * Usage: const signedInUser = await ctx.runQuery(api.authHelpers.currentUser);
 * THIS FUNCTION IS READ-ONLY. DO NOT MODIFY.
 */
export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);

    if (user === null) {
      return null;
    }

    return user;
  },
});

/**
 * Use this function internally to get the current user data. Remember to handle the null user case.
 * @param ctx
 * @returns
 */
export const getCurrentUser = async (ctx: QueryCtx) => {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    return null;
  }
  return await ctx.db.get(userId);
};
