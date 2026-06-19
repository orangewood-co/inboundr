import mongoose from "mongoose";

export interface ResolvedUser {
  id?: string;
  name?: string;
  email?: string;
  lastSignInAt?: Date;
  image?: string;
}

/**
 * Resolve Better Auth user ids to their profile (name/email/image).
 * Users live in the raw `user` collection, keyed by either the string `id`
 * field or the ObjectId `_id`. The returned map is keyed by both so callers
 * can look up by whichever identifier they hold.
 */
export async function resolveUsersByIds(userIds: string[]): Promise<Map<string, ResolvedUser>> {
  const map = new Map<string, ResolvedUser>();
  const db = mongoose.connection.db;
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  if (!db || uniqueIds.length === 0) return map;

  const objectIds = uniqueIds
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  const users = await db
    .collection("user")
    .find({
      $or: [
        { id: { $in: uniqueIds } },
        ...(objectIds.length > 0 ? [{ _id: { $in: objectIds } }] : []),
      ],
    })
    .project({ id: 1, name: 1, email: 1, lastSignInAt: 1, image: 1 })
    .toArray();

  for (const user of users) {
    if (user.id) map.set(user.id as string, user as ResolvedUser);
    map.set(String(user._id), user as ResolvedUser);
  }
  return map;
}
