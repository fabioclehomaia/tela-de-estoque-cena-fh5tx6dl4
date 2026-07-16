import { Badge } from '@/components/ui/badge'
import { Lock } from 'lucide-react'

interface CurrentPermissionsProps {
  areas: { id: string; name: string }[]
  subareas: { id: string; name: string; area_id: string }[]
  selectedAreaIds: string[]
  selectedSubareaIds: string[]
  isAdmin: boolean
}

export function CurrentPermissions({
  areas,
  subareas,
  selectedAreaIds,
  selectedSubareaIds,
  isAdmin,
}: CurrentPermissionsProps) {
  if (isAdmin) {
    return (
      <div className="rounded-lg border border-purple-200 bg-purple-50/50 p-3">
        <div className="flex items-center gap-1.5 mb-1">
          <Lock className="w-3 h-3 text-purple-600" />
          <p className="text-xs font-semibold text-purple-700 uppercase tracking-wider">
            Configuração Atual
          </p>
        </div>
        <Badge
          variant="outline"
          className="bg-purple-50 text-purple-700 border-purple-200 font-normal text-[11px]"
        >
          Acesso Total (Administrador)
        </Badge>
      </div>
    )
  }

  const currentAreas = areas.filter((a) => selectedAreaIds.includes(a.id))
  const currentSubareas = subareas.filter((s) => selectedSubareaIds.includes(s.id))

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Lock className="w-3 h-3 text-zinc-400" />
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
          Configuração Atual
        </p>
      </div>
      {currentAreas.length === 0 && currentSubareas.length === 0 ? (
        <p className="text-sm text-zinc-400">Nenhuma permissão atribuída anteriormente.</p>
      ) : (
        <div className="space-y-1.5">
          {currentAreas.map((area) => {
            const areaSubs = currentSubareas.filter((s) => s.area_id === area.id)
            return (
              <div key={area.id} className="flex flex-wrap items-center gap-1.5">
                <Badge
                  variant="outline"
                  className="bg-emerald-50 text-emerald-700 border-emerald-200 font-medium text-[11px]"
                >
                  {area.name}
                </Badge>
                {areaSubs.map((sub) => (
                  <Badge
                    key={sub.id}
                    variant="outline"
                    className="bg-blue-50 text-blue-700 border-blue-200 font-normal text-[11px]"
                  >
                    {sub.name}
                  </Badge>
                ))}
              </div>
            )
          })}
          {currentSubareas
            .filter((s) => !currentAreas.some((a) => a.id === s.area_id))
            .map((sub) => (
              <Badge
                key={sub.id}
                variant="outline"
                className="bg-blue-50 text-blue-700 border-blue-200 font-normal text-[11px]"
              >
                {sub.name}
              </Badge>
            ))}
        </div>
      )}
    </div>
  )
}
