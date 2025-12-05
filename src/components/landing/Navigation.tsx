"use client";

import { useState } from "react";
import Link from "next/link";

export default function Navigation() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <nav className="bg-white sticky top-0 z-50">
      {/* <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-24"> */}
      <div className="max-w-7xl mx-auto px-6 sm:px-12 lg:px-0">
        <div className="flex justify-between items-center h-20">
          <Link href="/" className="flex items-center space-x-3">
            {/* <div className="w-10 h-10 bg-sky-600 rounded-lg flex items-center justify-center">
              <svg
                className="w-6 h-6 text-white"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div> */}
            <span className="text-xl font-semibold text-sky-600">
              PantherKolab
            </span>
          </Link>

          <div className="hidden md:flex items-center space-x-10">
            <Link
              href="#features"
              className="text-gray-700 hover:text-sky-600 font-medium transition-colors"
            >
              Features
            </Link>
            <Link
              href="#about"
              className="text-gray-700 hover:text-sky-600 font-medium transition-colors"
            >
              About
            </Link>
            <Link
              href="#contact"
              className="text-gray-700 hover:text-sky-600 font-medium transition-colors"
            >
              Contact
            </Link>
          </div>

          <div className="hidden md:flex items-center space-x-4">
            <Link
              href="/auth/login"
              className="px-6 py-2 text-gray-800 hover:text-sky-600 font-medium transition-colors"
            >
              Log In
            </Link>
            <Link
              href="/auth/signup"
              className="px-8 py-3 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold rounded-lg transition-all"
            >
              Get Started
            </Link>
          </div>

          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <svg
              className="w-6 h-6 text-gray-700"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              {isMenuOpen ? (
                <path d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-200">
            <div className="flex flex-col space-y-4">
              <Link
                href="#features"
                className="text-gray-700 hover:text-sky-600 font-medium transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Features
              </Link>
              <Link
                href="#about"
                className="text-gray-700 hover:text-sky-600 font-medium transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                About
              </Link>
              <Link
                href="#contact"
                className="text-gray-700 hover:text-sky-600 font-medium transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Contact
              </Link>
              <div className="pt-4 flex flex-col space-y-2">
                <Link
                  href="/auth/login"
                  className="px-6 py-2 text-center text-gray-700 hover:text-sky-600 font-medium transition-colors border border-gray-300 rounded-lg"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Log In
                </Link>
                <Link
                  href="/auth/signup"
                  className="px-6 py-2 text-center bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold rounded-lg transition-all"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Get Started
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
