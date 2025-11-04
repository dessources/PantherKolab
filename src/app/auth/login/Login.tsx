import React from "react";
import { LoginForm } from "@/components/auth/Login/LoginForm";
import * as authStyles from "@/components/auth/auth.style";
export function Login({}) {
  return (
    <div
      className="w-[100%] h-[100vh] relative bg-sky-600 shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] overflow-hidden"
      style={authStyles.root}
    >
      <div className="w-1/2 h-[1024px] px-16 py-24 right-[0px] top-0 absolute bg-gray-50 inline-flex flex-col items-center overflow-hidden gap-y-4">
        <LoginForm />
        <div className="left-[941px] top-[810px]  text-center justify-start text-zinc-600 text-sm font-bold font-['Bitter']">
          Powered by FIU Students, for FIU students
        </div>
      </div>

      <div
        className={`absolute left-0 top-1/2 -translate-y-1/2 w-[calc(50%)})] flex items-center justify-center`}
      >
        <div className="text-center text-white text-5xl font-bold font-['Bitter']">
          Your FIU, <br />
          Connected.
        </div>
      </div>

      {/* Decorative panther paws overlay - positioned at center horizontally, spanning both sections */}
      <div
        className="absolute top-[39px] left-1/2 -translate-x-1/2 w-[503px] h-[639px] pointer-events-none z-10"
        style={authStyles.decorativePaws}
      />
    </div>
  );
}
