"use client";

import { signOut, useSession } from "next-auth/react";
import { Button } from "../ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";

interface LogoutButtonProps {
  className?: string;
  variant?:
    | "default"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost"
    | "link";
  showUserInfo?: boolean;
}

export function LogoutButton({
  className,
  variant = "outline",
  showUserInfo = false,
}: LogoutButtonProps) {
  const { data: session } = useSession();

  const handleLogout = () => {
    signOut({ callbackUrl: "/login" });
  };

  const userInitials =
    session?.user?.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "U";

  if (showUserInfo && session?.user) {
    return (
      <div className={`flex items-center gap-3 ${className || ""}`}>
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarImage
              src={session.user.image || undefined}
              alt={session.user.name || "User"}
            />
            <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-xs">
              {userInitials}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium text-gray-700 hidden sm:inline">
            {session.user.name || session.user.email}
          </span>
        </div>
        <Button variant={variant} size="sm" onClick={handleLogout}>
          Logout
        </Button>
      </div>
    );
  }

  return (
    <Button variant={variant} onClick={handleLogout} className={className}>
      Logout
    </Button>
  );
}

// Compact version for header bars
export function UserMenu({ className }: { className?: string }) {
  const { data: session } = useSession();

  const handleLogout = () => {
    signOut({ callbackUrl: "/login" });
  };

  if (!session?.user) {
    return null;
  }

  const userInitials =
    session.user.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "U";

  return (
    <div
      className={`flex items-center gap-2 bg-white/80 backdrop-blur-sm rounded-full pl-1 pr-3 py-1 shadow-md ${className || ""}`}
    >
      <Avatar className="h-7 w-7">
        <AvatarImage
          src={session.user.image || undefined}
          alt={session.user.name || "User"}
        />
        <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-[10px]">
          {userInitials}
        </AvatarFallback>
      </Avatar>
      <span className="text-sm font-medium text-gray-700 max-w-[100px] truncate hidden sm:inline">
        {session.user.name?.split(" ")[0] || "User"}
      </span>
      <button
        onClick={handleLogout}
        className="text-gray-400 hover:text-gray-600 transition-colors ml-1"
        title="Logout"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
          />
        </svg>
      </button>
    </div>
  );
}
