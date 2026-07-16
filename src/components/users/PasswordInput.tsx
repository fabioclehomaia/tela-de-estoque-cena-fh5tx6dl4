import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface PasswordInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  hasExistingPassword?: boolean
}

export function PasswordInput({
  value,
  onChange,
  placeholder,
  hasExistingPassword,
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div className="relative">
      <Input
        type={showPassword ? 'text' : 'password'}
        inputMode="numeric"
        pattern="\d*"
        value={value}
        onChange={(e) => {
          const numericValue = e.target.value.replace(/\D/g, '').slice(0, 6)
          onChange(numericValue)
        }}
        placeholder={hasExistingPassword ? '•••••• (digite nova senha)' : placeholder}
        className="pr-10"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-0 top-0 h-full w-10 hover:bg-transparent"
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
