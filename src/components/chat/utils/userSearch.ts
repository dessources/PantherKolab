export interface SearchableUser {
  id: string;
  name: string;
  avatar?: string;
}

/**
 * Search for users in the database by name
 * Returns up to 3 users from the database that match the search term
 */
export async function searchUsersInDB(
  searchTerm: string
): Promise<SearchableUser[]> {
  if (!searchTerm.trim()) {
    return [];
  }

  try {
    const response = await fetch(
      `/api/users/search?q=${encodeURIComponent(searchTerm)}&limit=3`,
      {
        method: "GET",
        credentials: "include",
      }
    );

    if (!response.ok) {
      console.error("Failed to search users:", response.statusText);
      return [];
    }

    const data = await response.json();
    return data.users || [];
  } catch (error) {
    console.error("Error searching users:", error);
    return [];
  }
}

/**
 * Filter recent users (from existing conversations) by search term
 */
export function filterRecentUsers(
  recentUsers: SearchableUser[],
  searchTerm: string
): SearchableUser[] {
  if (!searchTerm.trim()) {
    return recentUsers;
  }

  const lowerSearch = searchTerm.toLowerCase();
  return recentUsers.filter((user) =>
    user.name.toLowerCase().includes(lowerSearch)
  );
}

/**
 * Combine database search results with filtered recent users
 * Database users appear first (up to 3), followed by matching recent users
 * Removes duplicates (users that appear in both lists)
 */
export function combineSearchResults(
  dbUsers: SearchableUser[],
  recentUsers: SearchableUser[]
): { dbUsers: SearchableUser[]; recentUsers: SearchableUser[] } {
  // Create a Set of DB user IDs for quick lookup
  const dbUserIds = new Set(dbUsers.map((u) => u.id));

  // Filter out recent users that are already in DB results
  const uniqueRecentUsers = recentUsers?.filter(
    (user) => !dbUserIds.has(user.id)
  );

  return {
    dbUsers,
    recentUsers: uniqueRecentUsers,
  };
}

/**
 * Debounce function for search input
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func(...args);
    }, delay);
  };
}
