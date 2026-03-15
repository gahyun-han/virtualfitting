'use client'

import { useRouter } from 'next/navigation'
import { LogOut, User, Mail, ShieldCheck, ChevronRight, Loader2 } from 'lucide-react'
import TopBar from '@/components/layout/TopBar'
import BottomNav from '@/components/layout/BottomNav'
import { useAuth } from '@/hooks/useAuth'

export default function ProfilePage() {
  const router = useRouter()
  const { user, loading, signOut } = useAuth()

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex flex-col">
        <TopBar title="Profile" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-zinc-400 animate-spin" />
        </div>
        <BottomNav />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <TopBar title="Profile" />

      <main className="flex-1 pb-24 overflow-y-auto">
        {/* Avatar */}
        <div className="flex flex-col items-center py-8 px-4">
          <div className="w-20 h-20 rounded-full bg-zinc-800 flex items-center justify-center mb-3">
            <User className="w-10 h-10 text-zinc-500" />
          </div>
          <h2 className="text-white font-semibold text-lg">
            {user?.email?.split('@')[0] ?? 'User'}
          </h2>
          <p className="text-zinc-500 text-sm">{user?.email}</p>
        </div>

        {/* Info section */}
        <div className="mx-4 space-y-3">
          <h3 className="text-zinc-500 text-xs font-semibold uppercase tracking-wider px-1">
            Account
          </h3>

          <div className="bg-zinc-900 rounded-2xl divide-y divide-zinc-800">
            <div className="flex items-center gap-3 px-4 py-3.5">
              <Mail className="w-5 h-5 text-zinc-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-zinc-500">Email</p>
                <p className="text-white text-sm truncate">{user?.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 px-4 py-3.5">
              <ShieldCheck className="w-5 h-5 text-zinc-500 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-zinc-500">Account status</p>
                <p className="text-green-400 text-sm font-medium">
                  {user?.email_confirmed_at ? 'Verified' : 'Unverified'}
                </p>
              </div>
            </div>
          </div>

          {/* App info */}
          <h3 className="text-zinc-500 text-xs font-semibold uppercase tracking-wider px-1 pt-3">
            App
          </h3>

          <div className="bg-zinc-900 rounded-2xl divide-y divide-zinc-800">
            <div className="flex items-center justify-between px-4 py-3.5">
              <span className="text-white text-sm">Version</span>
              <span className="text-zinc-500 text-sm">0.1.0</span>
            </div>
            <button className="w-full flex items-center justify-between px-4 py-3.5 active:bg-zinc-800 transition-colors">
              <span className="text-white text-sm">Privacy Policy</span>
              <ChevronRight className="w-4 h-4 text-zinc-500" />
            </button>
            <button className="w-full flex items-center justify-between px-4 py-3.5 active:bg-zinc-800 transition-colors">
              <span className="text-white text-sm">Terms of Service</span>
              <ChevronRight className="w-4 h-4 text-zinc-500" />
            </button>
          </div>

          {/* Sign out */}
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 bg-zinc-900 border border-zinc-800 text-red-400 rounded-2xl py-4 font-medium mt-4 active:scale-[0.98] transition-transform"
          >
            <LogOut className="w-5 h-5" />
            Sign out
          </button>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
