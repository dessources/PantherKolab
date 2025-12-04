"use client";
import { Suspense } from "react";
import { ConfirmEmailForm } from "@/components/auth/confirm-email";
import * as authStyles from "@/components/auth/auth.style";

function ConfirmEmailContent() {
  return (
    <div
      className="w-full h-screen relative bg-sky-600 shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] overflow-hidden"
      style={authStyles.root}
    >
      {/* Right side - Confirmation form */}
      <div className="w-1/2 justify-center h-full px-16 py-24 right-0 top-0 absolute bg-gray-50 inline-flex flex-col items-center overflow-hidden gap-y-4">
        <ConfirmEmailForm />
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

      {/* Decorative panther paws overlay */}
      <div
        className="absolute top-[39px] left-1/2 -translate-x-1/2 w-[503px] h-[639px] pointer-events-none z-10"
        style={authStyles.decorativePaws}
      />
    </div>
  );
}

export default function ConfirmEmail() {
  return (
    <Suspense
      fallback={
        <div className="w-full h-screen flex items-center justify-center bg-sky-600">
          <div className="text-white text-2xl font-bold font-['Bitter']">
            Loading...
          </div>
        </div>
      }
    >
      <ConfirmEmailContent />
    </Suspense>
  );
}
