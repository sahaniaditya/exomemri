'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { apiFetch } from "@/lib/api"

interface Profile {
  full_name: string
  username: string
  primary_role: string
  domain_of_focus: string
}

export default function DashboardPage() {
  const router = useRouter()
 
  
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

useEffect(() => {
  let isMounted = true;
  const loadProfile = async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        if (isMounted) setProfile(data);
      } else {
        console.error("Failed to load profile details");
      }
    } catch (error) {
      console.error("Failed to load profile details:", error);
    } finally {
      if (isMounted) setLoading(false);
    }
  };
  loadProfile();
  return () => { isMounted = false; };
}, []);

const handleLogout = async () => {
  try {
    // Our route reads the httpOnly cookie server-side, tells FastAPI to
    // destroy the session, and clears both cookies — none of which
    // client JS can actually do for httpOnly cookies on its own.
    await fetch("/api/auth/logout", { method: "POST" })
  } catch (error) {
    console.error("Logout failed:", error)
  } finally {
    
    router.push('/login')
  }
}
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="text-sm font-medium text-gray-500 animate-pulse">
          Loading Atlas Workspace...
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-gray-900">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-100 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <span className="text-xl font-black tracking-tight text-blue-600">ATLAS</span>
          <span className="text-xs bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full font-semibold">
            {profile?.domain_of_focus}
          </span>
        </div>
        <button
          onClick={handleLogout}
          className="text-sm font-medium text-gray-500 hover:text-red-600 transition-colors"
        >
          Sign Out
        </button>
      </nav>

      {/* Main Layout */}
      <main className="max-w-7xl mx-auto px-6 py-10">
        {/* Welcome Header */}
        <header className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome back, {profile?.full_name}!
          </h1>
          <p className="text-gray-500 mt-1">
            @{profile?.username} &bull; Personalizing workspace for a <span className="lowercase font-medium">{profile?.primary_role}</span>.
          </p>
        </header>

        {/* Dashboard Grid Sections */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Active Learning Space Widget */}
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm md:col-span-2">
            <h3 className="font-bold text-lg mb-2">Your Learning Space</h3>
            <p className="text-sm text-gray-500 mb-4">
              Templates and curated streams tailored to <span className="font-semibold text-gray-700">{profile?.domain_of_focus}</span> are active.
            </p>
            <div className="h-32 border border-dashed border-gray-200 rounded-lg flex items-center justify-center text-xs text-gray-400">
              [ Space Placeholder — Documents and browser extensions syncs go here ]
            </div>
          </div>

          {/* Quick Stats Sidebar */}
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
            <h3 className="font-bold text-lg mb-4">Account Overview</h3>
            <div className="space-y-3">
              <div>
                <span className="text-xs text-gray-400 block uppercase font-bold tracking-wider">Focus Target</span>
                <span className="text-sm font-medium">{profile?.domain_of_focus}</span>
              </div>
              <hr className="border-gray-100" />
              <div>
                <span className="text-xs text-gray-400 block uppercase font-bold tracking-wider">Role</span>
                <span className="text-sm font-medium">{profile?.primary_role}</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}