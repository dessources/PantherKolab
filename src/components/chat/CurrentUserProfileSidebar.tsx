"use client";

import { X, LogOut } from "lucide-react";
import Image from "next/image";
import { useAuth } from "@/components/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface CurrentUserProfileData {
  id: string;
  name: string;
  email: string;
  status: string;
  location: string;
  about: string;
}

interface CurrentUserProfileSidebarProps {
  profileData: CurrentUserProfileData | null;
  isVisible: boolean;
  onClose: () => void;
}

export default function CurrentUserProfileSidebar({
  profileData,
  isVisible,
  onClose,
}: CurrentUserProfileSidebarProps) {
  const { logout } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await logout();
      router.push("/auth/login");
      toast.info("Signed out successfully");
    } catch (error) {
      console.error("Error signing out:", error);
      toast.error("Failed to sign out");
    }
  };

  return (
    <div
      className={`absolute top-0 left-0 h-full w-96 bg-white shadow-lg
        transition-transform duration-300 ease-in-out
        ${isVisible ? "translate-x-0 z-40" : "-translate-x-full -z-10"}
      `}
    >
      <div className="h-full flex flex-col overflow-y-auto">
        {profileData && (
          <>
            {/* Header with Close Button */}
            <div className="relative">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 z-10 p-2 bg-white/80 hover:bg-white rounded-full cursor-pointer transition-colors"
              >
                <X className="w-5 h-5 text-gray-700" />
              </button>

              {/* Cover Photo */}
              <div className="relative h-90">
                <Image
                  src="https://images.unsplash.com/photo-1546519638-68e109498ffc?w=600"
                  className="w-full h-full object-cover"
                  alt="Cover"
                  width={383}
                  height={356}
                  priority
                />

                {/* Name + Status INSIDE the cover */}
                <div className="absolute bottom-4 left-6 text-white [text-shadow:0_1px_4px_rgba(0,0,0,0.6)]">
                  <h2 className="text-2xl font-bold capitalize">
                    {profileData.name}
                  </h2>

                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm font-semibold">Online</span>
                  </div>
                </div>
              </div>
            </div>

            {/* STATUS SECTION */}
            <div className="px-6 py-6">
              <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">
                STATUS:
              </h3>
              <p className="text-sm font-bold text-gray-900">
                {profileData.status}
              </p>
            </div>

            {/* INFO SECTION */}
            <div className="px-6 py-6">
              <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">
                INFO:
              </h3>

              <div className="space-y-4">
                <div>
                  <p className="text-xs text-gray-600 mb-1">Name</p>
                  <p className="text-sm font-bold text-gray-900 capitalize">
                    {profileData.name}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-600 mb-1">Email</p>
                  <p className="text-sm font-bold text-[#0066CC]">
                    {profileData.email}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-600 mb-1">Location</p>
                  <p className="text-sm font-bold text-gray-900">
                    {profileData.location}
                  </p>
                </div>
              </div>
            </div>

            {/* ABOUT ME */}
            <div className="px-6 py-6">
              <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">
                ABOUT ME
              </h3>

              <p className="text-sm font-bold text-gray-900 leading-relaxed">
                {profileData.about}
              </p>
            </div>

            {/* SIGN OUT BUTTON */}
            <div className="px-6 py-6 mt-auto">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors cursor-pointer"
              >
                <LogOut className="w-5 h-5" />
                <span className="font-semibold">Sign Out</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
