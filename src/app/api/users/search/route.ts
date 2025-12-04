import { NextRequest, NextResponse } from "next/server";
import { userService } from "@/services/userService";
import { getAuthenticatedUser } from "@/lib/auth/api-auth";

/**
 * GET /api/users/search
 * Search for users by name
 * Query params:
 *   - q: search term (required)
 *   - limit: max results to return (optional, default 10, max 20)
 */
export async function GET(req: NextRequest) {
  try {
    // Authenticate the request
    const auth = await getAuthenticatedUser();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get search parameters
    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get("q");
    const limitParam = searchParams.get("limit");

    // Validate search query
    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: "Search query is required" },
        { status: 400 }
      );
    }

    // Validate and parse limit
    let limit = 10;
    if (limitParam) {
      const parsedLimit = parseInt(limitParam, 10);
      if (isNaN(parsedLimit) || parsedLimit < 1) {
        return NextResponse.json(
          { error: "Invalid limit parameter" },
          { status: 400 }
        );
      }
      // Cap at 20 to prevent excessive queries
      limit = Math.min(parsedLimit, 20);
    }

    // Search for users
    const userProfiles = await userService.searchUsersByName(query, limit);

    // Transform to match the expected interface
    const users = userProfiles
      .filter((user) => user.userId !== auth.userId) // Exclude the current user
      .map((user) => ({
        id: user.userId,
        name: user.fullName || `${user.firstName} ${user.lastName}`,
        avatar: user.profilePicture || undefined,
      }));

    return NextResponse.json({ users }, { status: 200 });
  } catch (error: unknown) {
    console.error("Error searching users:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
