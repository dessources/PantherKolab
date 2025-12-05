"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/contexts/AuthContext";

/**
 * Protected Route Layout
 *
 * This layout wraps all routes under the (protected) folder.
 * It automatically redirects unauthenticated users to the login page.
 *
 * This provides a DRY solution - add any route to the (protected) folder
 * and it will automatically be protected without duplicating auth logic.
 */
export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    // Wait for auth to finish loading
    if (loading) return;

    // Redirect to login if not authenticated
    if (!user) {
      router.push("/auth/login");
    }
  }, [user, loading, router]);

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render protected content if not authenticated
  if (!user) {
    return null;
  }

  // Render protected content
  return <>{children}</>;
}
