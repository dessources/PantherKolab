"use client";

import { useAuth } from "@/components/contexts/AuthContext";
import { SignUpParams } from "@/types/AuthContextTypes";
import { useRouter } from "next/navigation";
import { useState } from "react";
import * as authStyles from "@/components/auth/auth.style";

export default function SignUp() {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    acceptTerms: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { register } = useAuth();
  const router = useRouter();

  // Password validation checks
  const passwordRequirements = {
    minLength: formData.password.length >= 8,
    hasUppercase: /[A-Z]/.test(formData.password),
    hasLowercase: /[a-z]/.test(formData.password),
    hasNumber: /\d/.test(formData.password),
    hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(formData.password),
  };

  const allRequirementsMet = Object.values(passwordRequirements).every(Boolean);

  // Password strength calculation
  const getPasswordStrength = () => {
    const metCount = Object.values(passwordRequirements).filter(Boolean).length;
    if (metCount === 0)
      return { label: "", colorKey: "empty" as const, width: "0%" };
    if (metCount <= 2)
      return { label: "Weak", colorKey: "weak" as const, width: "33%" };
    if (metCount <= 4)
      return { label: "Medium", colorKey: "medium" as const, width: "66%" };
    return { label: "Strong", colorKey: "strong" as const, width: "100%" };
  };

  const passwordStrength = getPasswordStrength();

  // Validate email is @fiu.edu
  const validateEmail = (email: string) => {
    return email.toLowerCase().endsWith("@fiu.edu");
  };

  // Handle input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  // Validate form
  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (formData.firstName.length < 2) {
      newErrors.firstName = "First name must be at least 2 characters";
    }

    if (formData.lastName.length < 2) {
      newErrors.lastName = "Last name must be at least 2 characters";
    }

    if (!validateEmail(formData.email)) {
      newErrors.email = "Please use your FIU email address";
    }

    if (!allRequirementsMet) {
      newErrors.password = "Password does not meet all requirements";
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    if (!formData.acceptTerms) {
      newErrors.acceptTerms = "You must accept the Terms & Conditions";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    process.env.NODE_ENV != "production" && console.log("Form data:", formData);

    const { firstName, lastName, email, password } = formData;
    const params: SignUpParams = {
      name: firstName.toLowerCase(),
      email: email,
      password: password,
      family_name: lastName.toLowerCase(),
    };

    try {
      await register(params);
      // Fixed: Use parentheses () not backticks ``
      router.push(`/auth/confirm-email?email=${encodeURIComponent(email)}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error("Error signing up:", error);
      setErrors(error.message || "Registration failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="w-[100%] h-[100vh] relative bg-sky-600 shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] overflow-hidden"
      style={authStyles.root}
    >
      {/* Right side - Sign up form */}
      <div className="w-1/2 h-full px-16 py-12 right-[0px] top-0 absolute bg-gray-50 flex flex-col items-center  justify-center overflow-y-auto gap-y-4">
        <div className="w-full max-w-md p-8 bg-white rounded-xl shadow-[0px_4px_16px_0px_rgba(0,0,0,0.08)] flex flex-col items-start gap-4">
          {/* Header */}
          <div className="w-full">
            <h1 className="text-sky-900 text-4xl font-bold font-['Bitter']">
              Create Account
            </h1>
            <p className="mt-2 text-zinc-600 text-base font-semibold font-['Bitter']">
              Join the FIU student community
            </p>
          </div>

          {/* First Name */}
          <div className="w-full">
            <label
              htmlFor="firstName"
              className="text-neutral-800 text-sm font-semibold font-['Bitter']"
            >
              First Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="firstName"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              placeholder="John"
              disabled={isLoading}
              className={`w-full h-12 px-4 mt-2 bg-white rounded-lg border ${
                errors.firstName ? "border-red-500" : "border-gray-200"
              } text-zinc-600 text-sm font-semibold font-['Bitter'] focus:outline-none focus:border-sky-600 disabled:bg-gray-100 disabled:cursor-not-allowed`}
            />
            {errors.firstName && (
              <p className="mt-1 text-red-500 text-xs">{errors.firstName}</p>
            )}
          </div>

          {/* Last Name */}
          <div className="w-full">
            <label
              htmlFor="lastName"
              className="text-neutral-800 text-sm font-semibold font-['Bitter']"
            >
              Last Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="lastName"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              placeholder="Doe"
              disabled={isLoading}
              className={`w-full h-12 px-4 mt-2 bg-white rounded-lg border ${
                errors.lastName ? "border-red-500" : "border-gray-200"
              } text-zinc-600 text-sm font-semibold font-['Bitter'] focus:outline-none focus:border-sky-600 disabled:bg-gray-100 disabled:cursor-not-allowed`}
            />
            {errors.lastName && (
              <p className="mt-1 text-red-500 text-xs">{errors.lastName}</p>
            )}
          </div>

          {/* FIU Email */}
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
              value={formData.email}
              onChange={handleChange}
              placeholder="johndoe@fiu.edu"
              disabled={isLoading}
              className={`w-full h-12 px-4 mt-2 bg-white rounded-lg border ${
                errors.email ? "border-red-500" : "border-gray-200"
              } text-zinc-600 text-sm font-semibold font-['Bitter'] focus:outline-none focus:border-sky-600 disabled:bg-gray-100 disabled:cursor-not-allowed`}
            />
            {errors.email && (
              <p className="mt-1 text-red-500 text-xs">{errors.email}</p>
            )}
          </div>

          {/* Password */}
          <div className="w-full">
            <label
              htmlFor="password"
              className="text-neutral-800 text-sm font-semibold font-['Bitter']"
            >
              Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter a strong password"
                disabled={isLoading}
                className={`w-full h-12 px-4 pr-12 mt-2 bg-white rounded-lg border ${
                  errors.password ? "border-red-500" : "border-gray-200"
                } text-zinc-600 text-sm font-semibold font-['Bitter'] focus:outline-none focus:border-sky-600 disabled:bg-gray-100 disabled:cursor-not-allowed`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 mt-1 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? "👁️" : "👁️‍🗨️"}
              </button>
            </div>

            {/* Password Strength Meter */}
            {formData.password && (
              <div className="mt-2">
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full transition-all duration-300"
                    style={{
                      backgroundColor:
                        authStyles.passwordStrength[passwordStrength.colorKey]
                          .backgroundColor,
                      width: passwordStrength.width,
                    }}
                  />
                </div>
                {passwordStrength.label && (
                  <p
                    className="mt-1 text-xs font-semibold"
                    style={{
                      color:
                        authStyles.passwordStrength[passwordStrength.colorKey]
                          .color,
                    }}
                  >
                    {passwordStrength.label}
                  </p>
                )}
              </div>
            )}

            {/* Password Requirements */}
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1">
              <RequirementItem met={passwordRequirements.minLength}>
                At least 8 characters
              </RequirementItem>
              <RequirementItem met={passwordRequirements.hasUppercase}>
                Contains uppercase letter
              </RequirementItem>
              <RequirementItem met={passwordRequirements.hasLowercase}>
                Contains lowercase letter
              </RequirementItem>
              <RequirementItem met={passwordRequirements.hasNumber}>
                Contains number
              </RequirementItem>
              <RequirementItem met={passwordRequirements.hasSpecial}>
                Contains special character
              </RequirementItem>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="w-full">
            <label
              htmlFor="confirmPassword"
              className="text-neutral-800 text-sm font-semibold font-['Bitter']"
            >
              Confirm Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Re-enter your password"
                disabled={isLoading}
                className={`w-full h-12 px-4 pr-12 mt-2 bg-white rounded-lg border ${
                  errors.confirmPassword ? "border-red-500" : "border-gray-200"
                } text-zinc-600 text-sm font-semibold font-['Bitter'] focus:outline-none focus:border-sky-600 disabled:bg-gray-100 disabled:cursor-not-allowed`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 mt-1 text-gray-500 hover:text-gray-700"
              >
                {showConfirmPassword ? "👁️" : "👁️‍🗨️"}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="mt-1 text-red-500 text-xs">
                {errors.confirmPassword}
              </p>
            )}
          </div>

          {/* Terms & Conditions */}
          <div className="w-full">
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                id="acceptTerms"
                name="acceptTerms"
                checked={formData.acceptTerms}
                onChange={handleChange}
                disabled={isLoading}
                className="w-4 h-4 mt-0.5 accent-sky-600 rounded cursor-pointer disabled:cursor-not-allowed"
              />
              <label
                htmlFor="acceptTerms"
                className="text-neutral-800 text-sm font-semibold font-['Bitter'] cursor-pointer"
              >
                I agree to the{" "}
                <a href="/terms" className="text-sky-600 hover:underline">
                  Terms & Conditions
                </a>
              </label>
            </div>
            {errors.acceptTerms && (
              <p className="mt-1 text-red-500 text-xs">{errors.acceptTerms}</p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading}
            className="w-full h-12 bg-yellow-500 rounded-lg flex items-center justify-center text-sky-900 text-base font-semibold font-['Bitter'] hover:bg-yellow-600 transition-colors cursor-pointer disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin">⏳</span>
                Creating account...
              </span>
            ) : (
              "Create Account"
            )}
          </button>

          {/* Login Link */}
          <div className="w-full text-center">
            <span className="text-neutral-800 text-sm font-semibold font-['Bitter']">
              Already have an account?{" "}
            </span>
            <a
              href="/auth/login"
              className="text-sky-600 text-sm font-semibold font-['Bitter'] hover:underline cursor-pointer"
            >
              Log In
            </a>
          </div>

          {/* Footer */}
          <div className="w-full text-center text-zinc-600 text-xs font-semibold font-['Bitter']">
            FIU Students Only • By signing up, you agree to our Terms of Service
            and Privacy Policy
          </div>
        </div>

        <div className="text-center text-zinc-600 text-sm font-bold font-['Bitter']">
          Powered by FIU Students, for FIU students
        </div>
      </div>

      {/* Left side - Branding */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[calc(50%)] flex items-center justify-center">
        <div className="text-center text-white text-5xl font-bold font-['Bitter']">
          Your FIU, <br />
          Connected.
        </div>
      </div>

      {/* <Image
        className="w-[503px] h-[639px] left-[465px] top-[39px] absolute opacity-5"
        width={503}
        height={639}
        src="/images/login-panther-paws.png"
        alt="Decorative panther paw steps"
      /> */}
    </div>
  );
}

// Helper component for password requirements
function RequirementItem({
  met,
  children,
}: {
  met: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={met ? "text-green-500" : "text-gray-400"}>
        {met ? "✓" : "○"}
      </span>
      <span className={met ? "text-green-600" : "text-gray-500"}>
        {children}
      </span>
    </div>
  );
}
