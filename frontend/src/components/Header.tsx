'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { MagnifyingGlassIcon, UserIcon, BookmarkIcon } from '@heroicons/react/24/outline';

export default function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center">
            <div className="text-2xl font-bold text-black">SchemeSync</div>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex space-x-8">
            <Link href="/search" className="flex items-center text-gray-600 hover:text-yellow-500">
              <MagnifyingGlassIcon className="h-5 w-5 mr-1" />
              Search Schemes
            </Link>
            {user && (
              <>
                <Link href="/dashboard" className="text-gray-600 hover:text-yellow-500">
                  Dashboard
                </Link>
                <Link href="/saved" className="flex items-center text-gray-600 hover:text-yellow-500">
                  <BookmarkIcon className="h-5 w-5 mr-1" />
                  Saved
                </Link>
              </>
            )}
          </nav>

          {/* User Menu */}
          <div className="flex items-center space-x-4">
            {user ? (
              <div className="relative group">
                <button className="flex items-center text-gray-600 hover:text-yellow-500">
                  <UserIcon className="h-5 w-5 mr-1" />
                  {user.name}
                </button>
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all border border-gray-200">
                  <Link href="/profile" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                    Profile
                  </Link>
                  <button
                    onClick={logout}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Logout
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex space-x-4">
                <Link href="/auth/login" className="text-gray-600 hover:text-yellow-500">
                  Login
                </Link>
                <Link
                  href="/auth/register"
                  className="bg-yellow-500 text-black px-4 py-2 rounded-md hover:bg-yellow-400 font-medium"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}