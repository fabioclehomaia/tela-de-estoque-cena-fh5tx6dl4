import { Outlet } from 'react-router-dom'
import { UserCircle } from 'lucide-react'

export default function Layout() {
  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col font-sans">
      <header className="sticky top-0 z-50 w-full border-b border-zinc-200 bg-white shadow-sm">
        <div className="flex h-16 items-center justify-between px-4 max-w-3xl mx-auto w-full">
          <div>
            <h1 className="text-2xl font-bold font-serif text-zinc-900 tracking-tight leading-none">
              Cena Risotteria
            </h1>
            <p className="text-[11px] font-bold text-emerald-800 uppercase tracking-widest mt-1">
              Contagem Semanal
            </p>
          </div>
          <button className="p-2 -mr-2 text-zinc-400 hover:text-emerald-800 transition-colors rounded-full focus:outline-none focus:bg-zinc-100">
            <UserCircle className="w-7 h-7" />
          </button>
        </div>
      </header>

      <main className="flex-1 w-full">
        <Outlet />
      </main>
    </div>
  )
}
