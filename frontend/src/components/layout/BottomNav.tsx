'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Grid2X2, Camera, Shirt, Clock, User } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/wardrobe', label: 'Wardrobe', icon: Grid2X2 },
  { href: '/upload', label: 'Upload', icon: Camera },
  { href: '/tryon', label: 'Try On', icon: Shirt },
  { href: '/history', label: 'History', icon: Clock },
  { href: '/profile', label: 'Profile', icon: User },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{ maxWidth: '28rem', margin: '0 auto', left: '50%', transform: 'translateX(-50%)', width: '100%' }}
    >
      <div className="bg-zinc-950 border-t border-zinc-800 flex items-stretch"
           style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive =
            pathname === href || (href !== '/wardrobe' && pathname.startsWith(href))

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors active:bg-zinc-900',
                isActive ? 'text-white' : 'text-zinc-500'
              )}
            >
              <Icon
                className={cn(
                  'w-5 h-5 transition-transform',
                  isActive && 'scale-110'
                )}
                strokeWidth={isActive ? 2.5 : 1.75}
              />
              <span
                className={cn(
                  'text-[10px] font-medium',
                  isActive ? 'text-white' : 'text-zinc-500'
                )}
              >
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
