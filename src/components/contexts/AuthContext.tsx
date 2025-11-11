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
import { authConfig } from "@/lib/amplify/amplify-config";
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
  }, []);

  const checkAuth = async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      setIsAuthenticated(true);
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
            name: name,
            phone_number: "+10000000000",
            ...additionalAttributes,
          },
        },
      });

      if (result.userId) {
        await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: result.userId,
            email: email,
            firstName: name,
            lastName: additionalAttributes.family_name || "",
          }),
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
