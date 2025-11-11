/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import {  useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import { useAuth } from "@/components/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function TestProfilePage() {
  const { user } = useAuth();
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchProfile = async () => {
    if (!user?.userId) {
      setError("Not logged in");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Get the token
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();

      process.env.NODE_ENV != "production" && console.log("Token:", token);
      process.env.NODE_ENV != "production" &&
        console.log("User ID:", user.userId);

      if (!token) {
        setError("No token found");
        return;
      }

      // FIXED: Use parentheses () instead of backticks ``
      const response = await fetch(`/api/users/${user.userId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Request failed");
        return;
      }

      setResult(data);
    } catch (err: any) {
      console.error("Error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Test Profile API</h1>

        <div className="mb-4">
          <p>Logged in as: {user?.userId || "Not logged in"}</p>
        </div>

        <button
          onClick={fetchProfile}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Loading..." : "Test Fetch Profile"}
        </button>

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded">
            <p className="text-red-800">Error: {error}</p>
          </div>
        )}

        {result && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded">
            <h2 className="font-bold mb-2">Success!</h2>
            <pre className="text-sm overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
