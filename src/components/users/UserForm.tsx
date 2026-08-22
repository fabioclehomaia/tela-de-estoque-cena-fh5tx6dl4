import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { KeyRound, CheckCircle2, Lock, Unlock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { User } from '@/services/users'
import { cn } from '@/lib/utils'
import { PasswordInput } from '@/components/users/PasswordInput'
import { CurrentPermissions } from '@/components/users/CurrentPermissions'

const userSchema = z
  .object({
    name: z.string().min(2, 'Mínimo 2 caracteres'),
    email: z.string().min(1, 'E-mail é obrigatório').email('E-mail inválido'),
    phone: z.string().optional(),
    role: z.enum(['admin', 'manager', 'employee'] as const),
    active: z.boolean(),
    area_ids: z.array(z.string()),
    subarea_ids: z.array(z.string()),
    password: z.string().optional(),
    passwordConfirm: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.role !== 'admin') {
      const hasArea = data.area_ids && data.area_ids.length > 0
      const hasSubarea = data.subarea_ids && data.subarea_ids.length > 0
      if (!hasArea && !hasSubarea) {
        ctx.addIssue({
          path: ['area_ids'],
          message: 'É necessário selecionar ao menos uma área ou subárea para salvar.',
          code: z.ZodIssueCode.custom,
        })
      }
    }

    const pwd = data.password ? data.password.trim() : ''
    const confirm = data.passwordConfirm ? data.passwordConfirm.trim() : ''

    // Se informou senha ou confirmação
    if (pwd.length > 0 || confirm.length > 0) {
      if (!/^\d{6}$/.test(pwd)) {
        ctx.addIssue({
          path: ['password'],
          message: 'A senha deve conter exatamente 6 dígitos numéricos',
          code: z.ZodIssueCode.custom,
        })
      }
      if (!/^\d{6}$/.test(confirm)) {
        ctx.addIssue({
          path: ['passwordConfirm'],
          message: 'A confirmação deve conter exatamente 6 dígitos numéricos',
          code: z.ZodIssueCode.custom,
        })
      }
      if (pwd !== confirm) {
        ctx.addIssue({
          path: ['passwordConfirm'],
          message: 'As senhas não coincidem. Digite o mesmo código de 6 dígitos.',
          code: z.ZodIssueCode.custom,
        })
      }
    }
  })

export type UserFormValues = z.infer<typeof userSchema>

interface UserFormProps {
  initialData?: User | null
  areas?: { id: string; name: string }[]
  subareas?: { id: string; name: string; area_id: string }[]
  onSubmit: (values: UserFormValues, setError: any) => Promise<void>
}

const getIdsArray = (fieldValue: any): string[] => {
  if (!fieldValue) return []
  if (Array.isArray(fieldValue)) {
    return fieldValue.map((v: any) => (typeof v === 'string' ? v : v?.id)).filter(Boolean)
  }
  if (typeof fieldValue === 'string' && fieldValue.trim() !== '') return [fieldValue]
  return []
}

export function UserForm({ initialData, areas = [], subareas = [], onSubmit }: UserFormProps) {
  const isEditing = !!initialData
  const [isPasswordResetEnabled, setIsPasswordResetEnabled] = useState(!isEditing)

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      name: initialData?.name || '',
      email: initialData?.email || '',
      phone: initialData?.phone || '',
      role: (initialData?.role as any) || 'employee',
      active: initialData ? initialData.active : true,
      area_ids: [
        ...new Set([...getIdsArray(initialData?.area_ids), ...getIdsArray(initialData?.area_id)]),
      ],
      subarea_ids: [
        ...new Set([
          ...getIdsArray(initialData?.subarea_ids),
          ...getIdsArray(initialData?.subarea_id),
        ]),
      ],
      password: '',
      passwordConfirm: '',
    },
  })

  useEffect(() => {
    setIsPasswordResetEnabled(!initialData)
    form.reset({
      name: initialData?.name || '',
      email: initialData?.email || '',
      phone: initialData?.phone || '',
      role: (initialData?.role as any) || 'employee',
      active: initialData ? initialData.active : true,
      area_ids: [
        ...new Set([...getIdsArray(initialData?.area_ids), ...getIdsArray(initialData?.area_id)]),
      ],
      subarea_ids: [
        ...new Set([
          ...getIdsArray(initialData?.subarea_ids),
          ...getIdsArray(initialData?.subarea_id),
        ]),
      ],
      password: '',
      passwordConfirm: '',
    })
  }, [initialData, form])

  const handleTogglePasswordReset = () => {
    if (isPasswordResetEnabled) {
      // Cancelar reset: desabilita e limpa campos
      setIsPasswordResetEnabled(false)
      form.setValue('password', '', { shouldValidate: true })
      form.setValue('passwordConfirm', '', { shouldValidate: true })
      form.clearErrors(['password', 'passwordConfirm'])
    } else {
      // Habilitar reset
      setIsPasswordResetEnabled(true)
    }
  }

  const handleSubmit = async (values: UserFormValues) => {
    // Se estiver em edição e o reset de senha não tiver sido acionado, garantir que campos de senha fiquem vazios
    const payload = { ...values }
    if (isEditing && !isPasswordResetEnabled) {
      payload.password = ''
      payload.passwordConfirm = ''
    }

    if (payload.role === 'admin') {
      payload.area_ids = []
      payload.subarea_ids = []
    } else {
      const validSubareas = subareas.filter((s) => payload.area_ids.includes(s.area_id))
      payload.subarea_ids = payload.subarea_ids.filter((subId) =>
        validSubareas.some((s) => s.id === subId),
      )
    }
    await onSubmit(payload, form.setError)
  }

  const passwordVal = form.watch('password') || ''
  const passwordConfirmVal = form.watch('passwordConfirm') || ''
  const passwordsMatch =
    passwordVal.length === 6 &&
    passwordConfirmVal.length === 6 &&
    passwordVal === passwordConfirmVal

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 pt-2">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome Completo</FormLabel>
              <FormControl>
                <Input placeholder="Ex: João da Silva" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>E-mail / Login</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="joao@exemplo.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Telefone</FormLabel>
                <FormControl>
                  <Input placeholder="(11) 99999-9999" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem className="md:col-span-3">
                <FormLabel>Perfil</FormLabel>
                <Select
                  onValueChange={(v) => {
                    field.onChange(v)
                    form.trigger(['area_ids', 'subarea_ids'])
                  }}
                  value={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="employee">Funcionário</SelectItem>
                    <SelectItem value="manager">Gerente</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {form.watch('role') !== 'admin' && (
            <div className="md:col-span-3 space-y-3">
              {initialData && (
                <CurrentPermissions
                  areas={areas}
                  subareas={subareas}
                  selectedAreaIds={[
                    ...new Set([
                      ...getIdsArray(initialData?.area_ids),
                      ...getIdsArray(initialData?.area_id),
                    ]),
                  ]}
                  selectedSubareaIds={[
                    ...new Set([
                      ...getIdsArray(initialData?.subarea_ids),
                      ...getIdsArray(initialData?.subarea_id),
                    ]),
                  ]}
                  isAdmin={false}
                />
              )}
              <div className="flex items-start justify-between">
                <div>
                  <FormLabel>Permissões de Acesso</FormLabel>
                  <p className="text-xs text-zinc-500 mt-1">
                    Selecione as áreas e subáreas que este usuário poderá acessar.
                  </p>
                </div>
                {areas.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs font-medium"
                    onClick={() => {
                      const currentAreas = form.getValues('area_ids') || []
                      const allAreasSelected = areas.every((a) => currentAreas.includes(a.id))

                      if (allAreasSelected) {
                        form.setValue('area_ids', [], { shouldValidate: true })
                        form.setValue('subarea_ids', [], { shouldValidate: true })
                      } else {
                        form.setValue(
                          'area_ids',
                          areas.map((a) => a.id),
                          { shouldValidate: true },
                        )
                        form.setValue(
                          'subarea_ids',
                          subareas.map((s) => s.id),
                          { shouldValidate: true },
                        )
                      }
                    }}
                  >
                    {areas.every((a) => (form.watch('area_ids') || []).includes(a.id))
                      ? 'Desmarcar Todas'
                      : 'Marcar Todas'}
                  </Button>
                )}
              </div>
              <div className="h-64 overflow-y-auto border border-zinc-200 rounded-md p-3 space-y-3 bg-zinc-50/50">
                {areas.length === 0 && (
                  <div className="text-sm text-zinc-500 py-2 text-center">
                    Nenhuma área cadastrada.
                  </div>
                )}
                {areas.map((area) => {
                  const subs = subareas.filter((s) => s.area_id === area.id)
                  const isAreaSelected = form.watch('area_ids')?.includes(area.id) || false
                  const selectedSubs =
                    form.watch('subarea_ids')?.filter((id) => subs.some((s) => s.id === id)) || []

                  return (
                    <div
                      key={area.id}
                      className={cn(
                        'space-y-3 border rounded-md p-3 transition-colors',
                        isAreaSelected
                          ? 'bg-emerald-50/30 border-emerald-200'
                          : 'bg-white border-zinc-200',
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Checkbox
                            checked={isAreaSelected}
                            onCheckedChange={(checked) => {
                              let newAreas = [...(form.getValues('area_ids') || [])]
                              if (checked) {
                                newAreas.push(area.id)
                              } else {
                                newAreas = newAreas.filter((id) => id !== area.id)
                              }
                              form.setValue('area_ids', newAreas, { shouldValidate: true })
                            }}
                          />
                          <span
                            onClick={() => {
                              let newAreas = [...(form.getValues('area_ids') || [])]
                              if (!isAreaSelected) newAreas.push(area.id)
                              else newAreas = newAreas.filter((id) => id !== area.id)
                              form.setValue('area_ids', newAreas, { shouldValidate: true })
                            }}
                            className={cn(
                              'font-medium text-sm cursor-pointer select-none',
                              isAreaSelected && 'text-emerald-900',
                            )}
                          >
                            {area.name}
                          </span>
                        </div>
                        {subs.length > 0 && (
                          <div className="flex gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-emerald-700 hover:bg-emerald-100/50"
                              onClick={() => {
                                const currentAreas = form.getValues('area_ids') || []
                                const currentSubs = form.getValues('subarea_ids') || []
                                if (!currentAreas.includes(area.id)) currentAreas.push(area.id)
                                form.setValue('area_ids', currentAreas, { shouldValidate: true })
                                const newSubs = new Set([...currentSubs, ...subs.map((s) => s.id)])
                                form.setValue('subarea_ids', Array.from(newSubs), {
                                  shouldValidate: true,
                                })
                              }}
                            >
                              Marcar Todas
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-red-500 hover:bg-red-50"
                              onClick={() => {
                                const currentAreas = form.getValues('area_ids') || []
                                const currentSubs = form.getValues('subarea_ids') || []
                                form.setValue(
                                  'area_ids',
                                  currentAreas.filter((id) => id !== area.id),
                                  { shouldValidate: true },
                                )
                                form.setValue(
                                  'subarea_ids',
                                  currentSubs.filter((id) => !subs.some((s) => s.id === id)),
                                  { shouldValidate: true },
                                )
                              }}
                            >
                              Desmarcar
                            </Button>
                          </div>
                        )}
                      </div>

                      {subs.length > 0 && (
                        <div className="pl-7 grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                          {subs.map((sub) => {
                            const isSubSelected =
                              form.watch('subarea_ids')?.includes(sub.id) || false
                            return (
                              <div key={sub.id} className="flex items-center space-x-3">
                                <Checkbox
                                  checked={isSubSelected}
                                  onCheckedChange={(checked) => {
                                    let newSubs = [...(form.getValues('subarea_ids') || [])]
                                    if (checked) {
                                      newSubs.push(sub.id)
                                    } else {
                                      newSubs = newSubs.filter((id) => id !== sub.id)
                                    }
                                    form.setValue('subarea_ids', newSubs, { shouldValidate: true })
                                  }}
                                />
                                <span
                                  onClick={() => {
                                    let newSubs = [...(form.getValues('subarea_ids') || [])]
                                    if (!isSubSelected) newSubs.push(sub.id)
                                    else newSubs = newSubs.filter((id) => id !== sub.id)
                                    form.setValue('subarea_ids', newSubs, { shouldValidate: true })
                                  }}
                                  className="text-sm text-zinc-600 cursor-pointer select-none"
                                >
                                  {sub.name}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              {form.formState.errors.area_ids && (
                <p className="text-[0.8rem] font-medium text-destructive">
                  {form.formState.errors.area_ids.message}
                </p>
              )}
              {form.formState.errors.subarea_ids && (
                <p className="text-[0.8rem] font-medium text-destructive">
                  {form.formState.errors.subarea_ids.message}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Bloco de Senha / Reset de Senha */}
        <div className="border border-zinc-200 rounded-lg p-4 bg-zinc-50/70 space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-zinc-700" />
                <span className="font-semibold text-sm text-zinc-900">
                  {isEditing ? 'Senha de Acesso' : 'Definir Senha de Acesso'}
                </span>
              </div>
              <p className="text-xs text-zinc-500">
                {isEditing
                  ? 'A senha atual está protegida. Clique no botão ao lado para redefinir.'
                  : 'Digite uma senha numérica de 6 dígitos para o novo usuário.'}
              </p>
            </div>

            {isEditing && (
              <Button
                type="button"
                variant={isPasswordResetEnabled ? 'secondary' : 'outline'}
                size="sm"
                onClick={handleTogglePasswordReset}
                className={cn(
                  'text-xs font-medium shrink-0',
                  isPasswordResetEnabled
                    ? 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
                    : 'border-zinc-300 text-zinc-700 hover:bg-zinc-100',
                )}
              >
                {isPasswordResetEnabled ? (
                  <>
                    <Unlock className="w-3.5 h-3.5 mr-1.5 text-amber-700" /> Cancelar Reset
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5 mr-1.5 text-zinc-600" /> Resetar Senha
                  </>
                )}
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={cn(!isPasswordResetEnabled && 'text-zinc-400')}>
                    {isEditing ? 'Nova Senha (6 dígitos)' : 'Senha (6 dígitos)'}
                  </FormLabel>
                  <FormControl>
                    <PasswordInput
                      value={field.value || ''}
                      onChange={field.onChange}
                      disabled={!isPasswordResetEnabled}
                      placeholder={isPasswordResetEnabled ? '000000' : '•••••• (desabilitado)'}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="passwordConfirm"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={cn(!isPasswordResetEnabled && 'text-zinc-400')}>
                    {isEditing ? 'Confirmar Nova Senha' : 'Confirmar Senha'}
                  </FormLabel>
                  <FormControl>
                    <PasswordInput
                      value={field.value || ''}
                      onChange={field.onChange}
                      disabled={!isPasswordResetEnabled}
                      placeholder={isPasswordResetEnabled ? '000000' : '•••••• (desabilitado)'}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {isPasswordResetEnabled && passwordsMatch && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded p-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>As duas senhas coincidem e estão prontas para serem salvas.</span>
            </div>
          )}
        </div>

        {initialData && (
          <FormField
            control={form.control}
            name="active"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border border-zinc-200 p-3 shadow-sm bg-white">
                <div className="space-y-0.5">
                  <FormLabel>Status da Conta</FormLabel>
                  <p className="text-[13px] text-zinc-500">
                    {field.value ? 'Usuário pode acessar o sistema' : 'Acesso bloqueado'}
                  </p>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />
        )}

        <div className="flex justify-end pt-4">
          <Button
            type="submit"
            className="w-full sm:w-auto bg-emerald-800 hover:bg-emerald-900"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? 'Salvando...' : 'Salvar Usuário'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
