import { Link, Outlet, useLocation } from 'react-router-dom'
import {
  Menu,
  LogOut,
  Package,
  FileText,
  Users,
  ClipboardList,
  UserCircle,
  MapPin,
  Map,
  Tags,
} from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/use-auth'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export default function Layout() {
  const { user, signOut } = useAuth()
  const location = useLocation()

  const navItems = [
    {
      path: '/',
      label: 'Contagem de Estoque',
      icon: ClipboardList,
      roles: ['admin', 'manager', 'employee'],
    },
    { path: '/areas', label: 'Áreas', icon: MapPin, roles: ['admin', 'manager'] },
    { path: '/subareas', label: 'Subáreas', icon: Map, roles: ['admin', 'manager'] },
    { path: '/categories', label: 'Categorias', icon: Tags, roles: ['admin', 'manager'] },
    { path: '/products', label: 'Produtos', icon: Package, roles: ['admin', 'manager'] },
    { path: '/reports', label: 'Relatórios', icon: FileText, roles: ['admin', 'manager'] },
    { path: '/users', label: 'Usuários', icon: Users, roles: ['admin'] },
  ]

  const allowedNavItems = navItems.filter((item) => user && item.roles.includes(user.role))

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col font-sans">
      <header className="sticky top-0 z-50 w-full border-b border-zinc-200 bg-white shadow-sm">
        <div className="flex h-16 items-center justify-between px-4 max-w-6xl mx-auto w-full">
          <div className="flex items-center gap-4">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="-ml-2 md:hidden">
                  <Menu className="w-6 h-6 text-zinc-600" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px] flex flex-col">
                <SheetHeader className="text-left">
                  <SheetTitle className="font-serif text-xl text-emerald-900">
                    Cena Risotteria
                  </SheetTitle>
                  <SheetDescription className="sr-only">Menu de navegação</SheetDescription>
                </SheetHeader>

                <div className="py-4 border-b border-zinc-100 flex items-center gap-3">
                  <UserCircle className="w-10 h-10 text-emerald-800" />
                  <div className="flex flex-col overflow-hidden">
                    <span className="text-sm font-semibold text-zinc-900 truncate">
                      {user?.name}
                    </span>
                    <Badge
                      variant="secondary"
                      className="w-fit text-[10px] mt-0.5 capitalize bg-zinc-100 text-zinc-600"
                    >
                      {user?.role}
                    </Badge>
                  </div>
                </div>

                <nav className="flex-1 py-4 flex flex-col gap-1">
                  {allowedNavItems.map((item) => {
                    const Icon = item.icon
                    const isActive = location.pathname === item.path
                    return (
                      <SheetTrigger asChild key={item.path}>
                        <Link
                          to={item.path}
                          className={cn(
                            'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors',
                            isActive
                              ? 'bg-emerald-50 text-emerald-900'
                              : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900',
                          )}
                        >
                          <Icon className="w-5 h-5" />
                          {item.label}
                        </Link>
                      </SheetTrigger>
                    )
                  })}
                </nav>

                <div className="pt-4 border-t border-zinc-100">
                  <Button
                    variant="ghost"
                    className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={signOut}
                  >
                    <LogOut className="w-5 h-5 mr-3" />
                    Sair do sistema
                  </Button>
                </div>
              </SheetContent>
            </Sheet>

            <div>
              <h1 className="text-xl md:text-2xl font-bold font-serif text-zinc-900 tracking-tight leading-none hidden md:block">
                Cena Risotteria
              </h1>
              <p className="text-[11px] font-bold text-emerald-800 uppercase tracking-widest mt-1 hidden md:block">
                Sistema de Gestão
              </p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-1 mx-4 flex-1 justify-center">
            {allowedNavItems.map((item) => {
              const isActive = location.pathname === item.path
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'px-3 py-2 rounded-md text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-emerald-50 text-emerald-900'
                      : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900',
                  )}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex flex-col items-end text-right">
              <span className="text-sm font-semibold text-zinc-900">{user?.name}</span>
              <span className="text-xs text-zinc-500 capitalize">{user?.role}</span>
            </div>

            <div className="md:hidden flex items-center">
              <h1 className="text-xl font-bold font-serif text-emerald-900 tracking-tight leading-none">
                Cena
              </h1>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full hidden md:flex">
                  <UserCircle className="w-8 h-8 text-emerald-800" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 mt-2">
                <div className="flex flex-col space-y-1 p-2">
                  <p className="text-sm font-medium leading-none">{user?.name}</p>
                  <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                  <Badge
                    variant="secondary"
                    className="w-fit mt-2 capitalize bg-zinc-100 text-zinc-600"
                  >
                    {user?.role}
                  </Badge>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-red-600 cursor-pointer focus:text-red-600 focus:bg-red-50"
                  onClick={signOut}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sair do sistema</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full flex flex-col items-center">
        <Outlet />
      </main>
    </div>
  )
}
