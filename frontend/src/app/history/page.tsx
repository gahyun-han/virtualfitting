'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Clock, ChevronRight, Loader2, AlertCircle } from 'lucide-react'
import TopBar from '@/components/layout/TopBar'
import BottomNav from '@/components/layout/BottomNav'
import { getTryOnHistory } from '@/lib/api'
import { formatDate, cn } from '@/lib/utils'
import type { TryOnJob } from '@/types'

const STATUS_STYLE: Record<TryOnJob['status'], string> = {
  pending: 'bg-zinc-800 text-zinc-300',
  processing: 'bg-blue-900 text-blue-200',
  completed: 'bg-green-900 text-green-200',
  failed: 'bg-red-900 text-red-200',
}

export default function HistoryPage() {
  const [jobs, setJobs] = useState<TryOnJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getTryOnHistory()
      .then((data) => {
        setJobs(data)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <TopBar title="Try-On History" />

      <main className="flex-1 pb-24 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 text-zinc-400 animate-spin" />
          </div>
        ) : error ? (
          <div className="px-4 py-8 flex flex-col items-center gap-3 text-center">
            <AlertCircle className="w-10 h-10 text-red-400" />
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 px-8 text-center">
            <Clock className="w-16 h-16 text-zinc-700 mb-4" />
            <h3 className="text-zinc-300 font-semibold text-lg mb-2">
              No try-ons yet
            </h3>
            <p className="text-zinc-500 text-sm">
              Select a clothing item from your wardrobe and hit &ldquo;Try On&rdquo;.
            </p>
            <Link
              href="/wardrobe"
              className="mt-6 bg-white text-black font-semibold rounded-2xl px-6 py-3 text-sm active:scale-[0.98] transition-transform"
            >
              Browse Wardrobe
            </Link>
          </div>
        ) : (
          <div className="px-4 pt-4 space-y-3">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="bg-zinc-900 rounded-2xl overflow-hidden"
              >
                <Link
                  href={
                    job.status === 'completed' && job.result_url
                      ? `/tryon/result?result=${encodeURIComponent(job.result_url)}&person=${encodeURIComponent(job.person_image_url)}`
                      : '#'
                  }
                  className="flex items-center gap-3 p-3"
                >
                  {/* Thumbnail */}
                  <div className="relative w-14 h-16 rounded-xl overflow-hidden bg-zinc-800 flex-shrink-0">
                    {job.result_url ? (
                      <Image
                        src={job.result_url}
                        alt="Try-on result"
                        fill
                        className="object-cover"
                      />
                    ) : job.person_image_url ? (
                      <Image
                        src={job.person_image_url}
                        alt="Person photo"
                        fill
                        className="object-cover opacity-50"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-zinc-800" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={cn(
                          'text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide',
                          STATUS_STYLE[job.status]
                        )}
                      >
                        {job.status}
                      </span>
                    </div>
                    <p className="text-zinc-500 text-xs">
                      {formatDate(job.created_at)}
                    </p>
                    {job.error_message && (
                      <p className="text-red-400 text-xs mt-1 truncate">
                        {job.error_message}
                      </p>
                    )}
                  </div>

                  {job.status === 'completed' && (
                    <ChevronRight className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                  )}
                </Link>
              </div>
            ))}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
