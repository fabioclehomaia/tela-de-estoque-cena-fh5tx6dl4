import { useEffect, useState } from 'react'
import { Plus, Edit2, Shield, User as UserIcon, Phone, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { extractFieldErrors } from '@/lib/pocketbase/errors'
import { getUsers, createUser, updateUser, User } from '@/services/users'
import { UserRole } from '@/hooks/use-auth'
import { useRealtime } from '@/hooks/use-realtime'
import { cn } from '@/lib/utils'
import { UserForm, UserFormValues } from '@/components/users/UserForm'
import pb from '@/lib/pocketbase/client'

export default function Users() {
  const [users, setUsers] = useState<User[]>([])
  const [areas, setAreas] = useState<{ id: string; name: string }[]>([])
  const [subareas, setSubareas] = useState<{ id: string; name: string; area_id: string }[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const loadData = async () => {
    try {
      const [usersData, areasData, subareasData] = await Promise.all([
        getUsers(),
        pb.collection('areas').getFullList<{ id: string; name: string }>({ sort: 'name' }),
        pb
          .collection('subareas')
          .getFullList<{ id: string; name: string; area_id: string }>({ sort: 'name' }),
      ])
      setUsers(usersData)
      setAreas(areasData)
      setSubareas(subareasData)
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao carregar usuários' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])
  useRealtime<User>('users', () => {
    loadData()
  })

  const openDialog = (user?: User) => {
    setEditingUser(user || null)
    setIsDialogOpen(true)
  }

  const onSubmit = async (values: UserFormValues, setError: any) => {
    try {
      if (editingUser) {
        const payload: any = { ...values }
        if (values.password) {
          payload.password = values.password
          payload.passwordConfirm = values.password
        } else {
          delete payload.password
        }
        await updateUser(editingUser.id, payload)
      } else {
        if (!values.password) {
          setError('password', { message: 'Senha obrigatória para novos usuários' })
          return
        }
        await createUser({ ...values, password: values.password, passwordConfirm: values.password })
      }
      toast({ title: 'Salvo com sucesso', className: 'bg-emerald-800 text-white border-none' })
      setIsDialogOpen(false)
    } catch (err) {
      const errors = extractFieldErrors(err)
      if (Object.keys(errors).length > 0) {
        Object.entries(errors).forEach(([f, m]) => setError(f, { message: m }))
      } else {
        toast({ variant: 'destructive', title: 'Erro ao salvar' })
      }
    }
  }

  const toggleStatus = async (user: User) => {
    try {
      await updateUser(user.id, { active: !user.active })
      toast({ title: `Status alterado com sucesso` })
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao alterar status' })
    }
  }

  const RoleBadge = ({ role }: { role: UserRole }) => {
    const variants = {
      admin: 'bg-purple-100 text-purple-800 border-none',
      manager: 'bg-blue-100 text-blue-800 border-none',
      employee: 'bg-zinc-100 text-zinc-800 border-none',
    }
    return (
      <Badge variant="outline" className={cn('capitalize font-semibold', variants[role])}>
        {role === 'admin' ? (
          <Shield className="w-3 h-3 mr-1" />
        ) : (
          <UserIcon className="w-3 h-3 mr-1" />
        )}
        {role === 'admin' ? 'Administrador' : role === 'manager' ? 'Gerente' : 'Funcionário'}
      </Badge>
    )
  }

  if (loading)
    return <div className="p-8 text-center text-zinc-500 animate-pulse">Carregando usuários...</div>

  return (
    <div className="container max-w-5xl mx-auto px-4 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Gestão de Usuários</h1>
          <p className="text-sm text-zinc-500 mt-1">Gerencie os perfis e acessos ao sistema.</p>
        </div>
        <Button onClick={() => openDialog()} className="bg-emerald-800 hover:bg-emerald-900">
          <Plus className="w-4 h-4 mr-2" /> Novo Usuário
        </Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Editar Usuário' : 'Novo Usuário'}</DialogTitle>
          </DialogHeader>
          {isDialogOpen && (
            <UserForm
              initialData={editingUser}
              areas={areas}
              subareas={subareas}
              onSubmit={onSubmit}
            />
          )}
        </DialogContent>
      </Dialog>

      <div className="grid gap-3">
        {users.map((user) => (
          <Card
            key={user.id}
            className={cn(
              'transition-colors border-zinc-200 shadow-sm',
              !user.active && 'bg-zinc-50 opacity-75',
            )}
          >
            <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    'w-12 h-12 rounded-full flex items-center justify-center shrink-0',
                    user.active ? 'bg-emerald-100 text-emerald-800' : 'bg-zinc-200 text-zinc-500',
                  )}
                >
                  <span className="font-bold text-lg">{user.name.charAt(0).toUpperCase()}</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className={cn('font-semibold text-base', !user.active && 'text-zinc-500')}>
                      {user.name}
                    </h3>
                    {!user.active && (
                      <Badge variant="secondary" className="text-[10px] bg-zinc-200 uppercase">
                        Inativo
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-1 sm:gap-4 text-sm text-zinc-500 mt-1">
                    <span className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5" />
                      {user.email}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5" />
                      {user.phone || '-'}
                    </span>
                  </div>
                  <div className="mt-3">
                    <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                      Permissões
                    </span>
                    <div className="flex items-center gap-2 mt-1">
                      {user.role === 'admin' ? (
                        <Badge
                          variant="outline"
                          className="bg-purple-50 text-purple-700 border-purple-200 font-normal text-[11px]"
                        >
                          Acesso Total
                        </Badge>
                      ) : (
                        <>
                          <Badge
                            variant="outline"
                            className="bg-emerald-50 text-emerald-700 border-emerald-200 font-medium text-[11px]"
                          >
                            {Array.isArray(user.area_ids)
                              ? user.area_ids.length
                              : user.area_id
                                ? 1
                                : 0}{' '}
                            {(Array.isArray(user.area_ids)
                              ? user.area_ids.length
                              : user.area_id
                                ? 1
                                : 0) === 1
                              ? 'Área'
                              : 'Áreas'}
                          </Badge>
                          <Badge
                            variant="outline"
                            className="bg-blue-50 text-blue-700 border-blue-200 font-medium text-[11px]"
                          >
                            {Array.isArray(user.subarea_ids)
                              ? user.subarea_ids.length
                              : user.subarea_id
                                ? 1
                                : 0}{' '}
                            {(Array.isArray(user.subarea_ids)
                              ? user.subarea_ids.length
                              : user.subarea_id
                                ? 1
                                : 0) === 1
                              ? 'Subárea'
                              : 'Subáreas'}
                          </Badge>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-0 border-zinc-100 mt-2 sm:mt-0">
                <div className="flex-1 sm:flex-none">
                  <RoleBadge role={user.role} />
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleStatus(user)}
                    className={cn(
                      'w-[90px] text-xs font-medium',
                      user.active
                        ? 'text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700'
                        : 'text-emerald-700 border-emerald-200 hover:bg-emerald-50',
                    )}
                  >
                    {user.active ? 'Desativar' : 'Ativar'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openDialog(user)}
                    className="text-zinc-500 hover:text-emerald-800"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
