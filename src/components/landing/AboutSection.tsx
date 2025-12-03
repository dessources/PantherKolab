"use client";

import Image from "next/image";

export default function AboutSection() {
  return (
    <section id="about" className="py-20 px-6 sm:px-12 lg:px-24 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <div className="inline-block bg-sky-100 text-sky-600 px-5 py-2 rounded-full text-sm font-semibold mb-6">
            About PantherKolab
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold text-sky-600 mb-4">
            Built by Panthers, for Panthers
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-20">
          <div className="relative order-2 lg:order-1">
            <div className="relative rounded-2xl overflow-hidden shadow-xl">
              <Image
                src="https://panthernow.com/wp-content/uploads/48754508006_44e4c8ea3b_k.jpg"
                alt="FIU campus building"
                width={800}
                height={600}
                className="w-full h-auto object-cover"
              />
            </div>
          </div>

          <div className="space-y-6 order-1 lg:order-2">
            <p className="text-lg text-gray-700 leading-relaxed">
              PantherKolab was created by FIU students who saw the need for a better way to connect and collaborate on campus. We understand the challenges of finding study partners, organizing group projects, and building a community in a large university.
            </p>
            <p className="text-lg text-gray-700 leading-relaxed">
              Our platform makes it easy to find your people, whether you&apos;re looking for study buddies in your major, teammates for a project, or friends who share your interests. Join thousands of Panthers who are already using PantherKolab to enhance their college experience.
            </p>
            <div className="grid grid-cols-2 gap-6 pt-6">
              <div>
                <div className="text-4xl font-bold text-yellow-500 mb-2">100%</div>
                <div className="text-sm text-gray-700 font-medium">FIU Student Verified</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-yellow-500 mb-2">24/7</div>
                <div className="text-sm text-gray-700 font-medium">Community Support</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
