"use client";

import Image from "next/image";
import Link from "next/link";

export default function HeroSection() {
  return (
    <section className="relative bg-white py-16 px-6 sm:px-12 lg:px-24">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <div className="inline-block bg-white border-2 border-sky-600 px-5 py-2 rounded-full text-sm text-sky-600 font-medium">
              Connect. Collaborate. Succeed.
            </div>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-tight text-sky-600">
              Build Your Community<br />at FIU
            </h1>
            <p className="text-lg text-gray-700 max-w-xl leading-relaxed">
              PantherKolab brings FIU students together. Create study groups, join clubs, organize events, and connect with peers who share your interests and goals.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Link
                href="/auth/signup"
                className="inline-flex items-center justify-center px-8 py-4 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold rounded-xl transition-all shadow-sm hover:shadow-md"
              >
                Join Now →
              </Link>
              <Link
                href="#features"
                className="inline-flex items-center justify-center px-8 py-4 bg-white border-2 border-sky-600 text-sky-600 font-semibold rounded-xl transition-all hover:bg-sky-50"
              >
                Learn More
              </Link>
            </div>
            <div className="flex gap-12 pt-8">
              <div>
                <div className="text-3xl font-bold text-yellow-500">5,000+</div>
                <div className="text-sm text-gray-600">Active Students</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-yellow-500">500+</div>
                <div className="text-sm text-gray-600">Active Groups</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-yellow-500">50+</div>
                <div className="text-sm text-gray-600">Campus Events</div>
              </div>
            </div>
          </div>
          <div className="relative">
            <div className="relative rounded-2xl overflow-hidden shadow-xl">
              <Image
                src="https://res.cloudinary.com/digicomm/image/upload/t_metadata/news-magazine/2023/_assets/welcome-2023.jpg"
                alt="FIU students collaborating together"
                width={800}
                height={600}
                className="w-full h-auto object-cover"
                priority
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
