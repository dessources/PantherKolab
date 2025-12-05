/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { Amplify } from "aws-amplify";
import { authConfig } from "@/lib/amplify/amplify-server-config";
import {
  signIn,
  signOut,
  signUp,
  confirmSignUp,
  getCurrentUser,
  fetchAuthSession,
  SignInOutput,
  resendSignUpCode,
  AuthUser,
  resetPassword,
  confirmResetPassword,
} from "aws-amplify/auth";
import {
  AuthContextType,
  VerifyParams,
  SignUpParams,
  ResetPasswordParams,
} from "@/types/AuthContextTypes";

if (typeof window !== "undefined") {
  Amplify.configure({ Auth: authConfig }, { ssr: true });
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Storage key for pending profile data
const PENDING_PROFILE_KEY = "pantherkolab_pending_profile";

// Helper to store pending profile data during registration
function storePendingProfile(data: {
  firstName: string;
  lastName: string;
  email: string;
}) {
  if (typeof window !== "undefined") {
    localStorage.setItem(PENDING_PROFILE_KEY, JSON.stringify(data));
  }
}

// Helper to get and clear pending profile data
function getPendingProfile(): {
  firstName: string;
  lastName: string;
  email: string;
} | null {
  if (typeof window === "undefined") return null;
  const data = localStorage.getItem(PENDING_PROFILE_KEY);
  if (data) {
    localStorage.removeItem(PENDING_PROFILE_KEY);
    return JSON.parse(data);
  }
  return null;
}

// Provider Component
export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  useEffect(() => {
    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Create DynamoDB profile for authenticated user if it doesn't exist
   */
  const ensureUserProfile = async () => {
    try {
      // Get pending profile data from registration
      const pendingProfile = getPendingProfile();
      if (!pendingProfile) {
        // No pending profile - user already has one or logged in without registering
        return;
      }

      // Create the profile via authenticated API route
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // Include cookies for auth
        body: JSON.stringify({
          firstName: pendingProfile.firstName,
          lastName: pendingProfile.lastName,
        }),
      });

      if (response.ok) {
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        process.env.NODE_ENV !== "production" && console.log("[Auth] User profile created successfully");
      } else if (response.status === 409) {
        // Profile already exists - that's fine
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        process.env.NODE_ENV !== "production" && console.log("[Auth] User profile already exists");
      } else {
        const data = await response.json();
        console.error("[Auth] Failed to create user profile:", data.error);
      }
    } catch (err) {
      console.error("[Auth] Error creating user profile:", err);
    }
  };

  const checkAuth = async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      setIsAuthenticated(true);

      // Ensure user has a DynamoDB profile (creates one if pending from registration)
      await ensureUserProfile();
    } catch {
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    setError("");
    setLoading(true);
    try {
      const result: SignInOutput = await signIn({
        username: email,
        password: password,
      });
      if (result.isSignedIn) {
        await checkAuth();
      }
    } catch (err: any) {
      const errorMessage = err.message || "Login failed";
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const register = async ({
    name,
    email,
    password,
    ...additionalAttributes
  }: SignUpParams) => {
    setError("");
    setLoading(true);
    try {
      const result = await signUp({
        username: email.split("@")[0],
        password: password,
        options: {
          userAttributes: {
            email: email,
            name: name.toLowerCase(),
            phone_number: "+10000000000",
            ...additionalAttributes,
            family_name: additionalAttributes.family_name?.toLowerCase(),
          },
        },
      });

      if (result.userId) {
        // Store profile data for creation after login
        // The DynamoDB profile will be created when the user logs in
        // This is secure because the API route uses the authenticated userId
        storePendingProfile({
          firstName: name.toLowerCase(),
          lastName: (additionalAttributes.family_name || "").toLowerCase(),
          email: email,
        });
      }
    } catch (err: any) {
      const errorMessage = err.message || "Registration failed";
      setError(errorMessage);
      console.error("Registration error:", err);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const verify = async ({ email, code }: VerifyParams) => {
    setError("");
    setLoading(true);
    try {
      await confirmSignUp({
        username: email.split("@")[0],
        confirmationCode: code,
      });
    } catch (err: any) {
      const errorMessage = err.message || "Verification failed";
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const resendVerificationCode = async (email: string) => {
    setError("");
    setResending(true);
    try {
      await resendSignUpCode({
        username: email.split("@")[0],
      });
      setResendSuccess(true);
    } catch (err: any) {
      const errorMessage = err.message || "Failed to resend code";
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setResending(false);
    }
  };

  const forgotPassword = async (email: string) => {
    setError("");
    setLoading(true);
    try {
      await resetPassword({
        username: email.split("@")[0],
      });
    } catch (err: any) {
      const errorMessage = err.message || "Failed to send reset code";
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const confirmResetPasswordFunc = async ({
    email,
    code,
    newPassword,
  }: ResetPasswordParams) => {
    setError("");
    setLoading(true);
    try {
      await confirmResetPassword({
        username: email.split("@")[0],
        confirmationCode: code,
        newPassword: newPassword,
      });
    } catch (err: any) {
      const errorMessage = err.message || "Failed to reset password";
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await signOut();
      setIsAuthenticated(false);
      setUser(null);
    } catch (err: any) {
      const errorMessage = err.message || "Logout failed";
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const getAccessToken = async () => {
    try {
      // Force fetching the latest session
      const session = await fetchAuthSession({ forceRefresh: true });
      return session.tokens?.accessToken?.toString() || null;
    } catch (err) {
      console.error("Failed to get access token:", err);
      return null;
    }
  };

  const clearError = () => {
    setError("");
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        loading,
        user,
        error,
        resending,
        login,
        logout,
        register,
        verify,
        resendVerificationCode,
        forgotPassword,
        confirmResetPassword: confirmResetPasswordFunc,
        resendSuccess,
        getAccessToken,
        setError,
        clearError,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Hook
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
