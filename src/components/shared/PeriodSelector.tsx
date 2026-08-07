import { useEffect, useState } from 'react'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export interface PeriodRange {
  start: string
  end: string
}

export function PeriodSelector({
  value,
  onChange,
}: {
  value: PeriodRange
  onChange: (range: PeriodRange) => void
}) {
  const [mode, setMode] = useState('weekly')

  useEffect(() => {
    const now = new Date()
    onChange({
      start: format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
      end: format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
    })
  }, [])

  const handleModeChange = (m: string) => {
    setMode(m)
    const now = new Date()
    if (m === 'weekly') {
      onChange({
        start: format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        end: format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
      })
    } else if (m === 'monthly') {
      onChange({
        start: format(startOfMonth(now), 'yyyy-MM-dd'),
        end: format(endOfMonth(now), 'yyyy-MM-dd'),
      })
    }
  }

  return (
    <div className="flex flex-col md:flex-row gap-3 items-end">
      <div className="w-full md:w-40">
        <label className="text-xs font-semibold text-zinc-500 mb-1.5 block">Tipo de Período</label>
        <Select value={mode} onValueChange={handleModeChange}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="weekly">Semanal</SelectItem>
            <SelectItem value="monthly">Mensal</SelectItem>
            <SelectItem value="custom">Personalizado</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {mode === 'custom' && (
        <>
          <div className="flex-1">
            <label className="text-xs font-semibold text-zinc-500 mb-1.5 block">Data Início</label>
            <Input
              type="date"
              value={value.start}
              onChange={(e) => onChange({ ...value, start: e.target.value })}
            />
          </div>
          <div className="flex-1">
            <label className="text-xs font-semibold text-zinc-500 mb-1.5 block">Data Fim</label>
            <Input
              type="date"
              value={value.end}
              onChange={(e) => onChange({ ...value, end: e.target.value })}
            />
          </div>
        </>
      )}
      {mode !== 'custom' && (
        <div className="text-sm text-zinc-500 py-2">
          {value.start} — {value.end}
        </div>
      )}
    </div>
  )
}
