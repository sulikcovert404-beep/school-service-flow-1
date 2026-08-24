import { paginationOptsValidator } from "convex/server";
import { query } from "./_generated/server";
import { requireSchoolAdmin } from "./guard";

/** Audit log of the admin's own school, newest first. */
export const list = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { schoolId } = await requireSchoolAdmin(ctx);
    const page = await ctx.db
      .query("auditLogs")
      .withIndex("by_school_time", (q) => q.eq("schoolId", schoolId))
      .order("desc")
      .paginate(args.paginationOpts);

    const items = await Promise.all(
      page.page.map(async (log) => {
        const actor = await ctx.db.get(log.actorUserId);
        return {
          id: log._id,
          action: log.action,
          resourceType: log.resourceType,
          summary: log.summary,
          createdAt: log.createdAt,
          actorName:
            actor?.name ??
            (actor?.email as string | undefined) ??
            "کاربر",
        };
      }),
    );

    return { ...page, page: items };
  },
});
