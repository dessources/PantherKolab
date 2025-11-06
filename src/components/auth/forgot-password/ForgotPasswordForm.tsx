"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/contexts/AuthContext";

export function ForgotPasswordForm() {
  const router = useRouter();
  const { forgotPassword, error, loading, setError } = useAuth();

  const [email, setEmail] = useState("");
  const [success, setSuccess] = useState(false);

  // Validate email is @fiu.edu
  const validateEmail = (email: string) => {
    return email.toLowerCase().endsWith("@fiu.edu");
  };

  const handleSubmit = async () => {
    setError("");

    if (!email) {
      setError("Please enter your email address");
      return;
    }

    if (!validateEmail(email)) {
      setError("Please use your FIU email address");
      return;
    }

    try {
      await forgotPassword(email);
      setSuccess(true);

      // Redirect to reset password page after 2 seconds
      setTimeout(() => {
        router.push(`/auth/reset-password?email=${encodeURIComponent(email)}`);
      }, 2000);
    } catch (err: unknown) {
      console.error("Forgot password error:", err);
    }
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    setError("");
  };

  return (
    <div className="w-96 p-8 bg-white rounded-xl shadow-[0px_4px_16px_0px_rgba(0,0,0,0.08)] flex flex-col justify-start items-start gap-5">
      {/* Header */}
      <div className="w-full">
        <h1 className="text-sky-900 text-4xl font-bold font-['Bitter']">
          Forgot Password
        </h1>
        <p className="mt-2 text-zinc-600 text-base font-semibold font-['Bitter']">
          {
            "Enter your FIU email and we'll send you a code to reset your password"
          }
        </p>
      </div>

      {/* Success Message */}
      {success && (
        <div className="w-full p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-600 text-sm font-semibold">
            Reset code sent! Check your email for the verification code.
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="w-full p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600 text-sm font-semibold">{error}</p>
        </div>
      )}

      {/* Email Input */}
      <div className="w-full">
        <label
          htmlFor="email"
          className="text-neutral-800 text-sm font-semibold font-['Bitter']"
        >
          FIU Email <span className="text-red-500">*</span>
        </label>
        <input
          type="email"
          id="email"
          name="email"
          value={email}
          onChange={handleEmailChange}
          placeholder="johndoe@fiu.edu"
          disabled={loading || success}
          className={`w-full h-12 px-4 mt-2 mb-2 bg-white rounded-lg border ${
            error ? "border-red-500" : "border-gray-200"
          } text-zinc-600 text-sm font-semibold font-['Bitter'] focus:outline-none focus:border-sky-600 disabled:bg-gray-100 disabled:cursor-not-allowed`}
        />
      </div>

      {/* Send Code Button */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={loading || success || !email}
        className="w-full h-12 bg-yellow-500 rounded-lg flex items-center justify-center text-sky-900 text-base font-semibold font-['Bitter'] hover:bg-yellow-600 transition-colors cursor-pointer disabled:bg-gray-300 disabled:cursor-not-allowed"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="animate-spin">⏳</span>
            Sending Code...
          </span>
        ) : success ? (
          "Code Sent!"
        ) : (
          "Send Reset Code"
        )}
      </button>

      {/* Back to Login */}
      <div className="w-full text-center">
        <span className="text-neutral-800 text-sm font-semibold font-['Bitter']">
          Remember your password?{" "}
        </span>
        <a
          href="/auth/login"
          className="text-sky-600 text-sm font-semibold font-['Bitter'] hover:underline cursor-pointer"
        >
          Log in
        </a>
      </div>

      {/* Footer */}
      <div className="w-full text-center text-zinc-600 text-xs font-semibold font-['Bitter']">
        {"Check your spam folder if you don't see the email"}
      </div>
    </div>
  );
}
