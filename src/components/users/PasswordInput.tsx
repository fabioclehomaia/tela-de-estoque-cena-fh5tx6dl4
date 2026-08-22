import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface PasswordInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  id?: string
}

export function PasswordInput({
  value,
  onChange,
  placeholder = '••••••',
  disabled = false,
  id,
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div className="relative">
      <Input
        id={id}
        type={showPassword ? 'text' : 'password'}
        inputMode="numeric"
        pattern="\d*"
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const numericValue = e.target.value.replace(/\D/g, '').slice(0, 6)
          onChange(numericValue)
        }}
        placeholder={placeholder}
        className="pr-10 disabled:bg-zinc-100 disabled:text-zinc-400 disabled:cursor-not-allowed"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={disabled}
        className="absolute right-0 top-0 h-full w-10 hover:bg-transparent disabled:opacity-30 disabled:pointer-events-none"
        onClick={() => setShowPassword(!showPassword)}
        tabIndex={-1}
      >
        {showPassword ? (
          <EyeOff className="w-4 h-4 text-zinc-500" />
        ) : (
          <Eye className="w-4 h-4 text-zinc-500" />
        )}
      </Button>
    </div>
  )
}
