"use client";

import Link from "next/link";
import Image from "next/image";

export default function CTASection() {
  return (
    <section className="relative py-20 px-6 sm:px-12 lg:px-24 bg-white">
      <div className="max-w-6xl mx-auto">
        <div className="bg-gradient-to-r from-sky-600 to-sky-700 rounded-3xl overflow-hidden shadow-2xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 items-center">
            <div className="space-y-6 p-12 lg:p-16 text-white">
              <h2 className="text-4xl sm:text-5xl font-bold leading-tight">
                Ready to Connect with Your Community?
              </h2>
              <p className="text-lg text-sky-100">
                Join PantherKolab today and discover a better way to collaborate, learn, and grow with fellow FIU students.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Link
                  href="/auth/signup"
                  className="inline-flex items-center justify-center px-8 py-4 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold rounded-xl transition-all shadow-lg hover:shadow-xl"
                >
                  Sign Up Free →
                </Link>
                <Link
                  href="#"
                  className="inline-flex items-center justify-center px-8 py-4 bg-white/10 hover:bg-white/20 backdrop-blur-sm border-2 border-white text-white font-semibold rounded-xl transition-all"
                >
                  Download App
                </Link>
              </div>
              <p className="text-sm text-sky-200">
                Join in seconds • FIU email required
              </p>
            </div>

            <div className="relative h-full min-h-[400px]">
              <Image
                src="https://res.cloudinary.com/digicomm/image/upload/t_metadata/news-magazine/2024/_assets/students-and-roary.jpg"
                alt="FIU students with Roary mascot"
                width={800}
                height={800}
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
