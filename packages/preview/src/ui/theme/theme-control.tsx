import { Monitor, Moon, Sun } from 'lucide-react'

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

import type { ThemePreference } from './theme'

import { useTheme } from './theme-context'

const options: { id: ThemePreference; label: string; Icon: typeof Sun }[] = [
  { id: 'white', label: 'Light', Icon: Sun },
  { id: 'dark', label: 'Dark', Icon: Moon },
  { id: 'system', label: 'System', Icon: Monitor },
]

export function ThemeControl() {
  const { preference, setPreference } = useTheme()
  return (
    <ToggleGroup
      aria-label="Theme"
      className="shrink-0"
      spacing={0}
      value={[preference]}
      variant="outline"
      onValueChange={(value) => {
        const next = value.find((item) => item !== preference) ?? value[0]
        if (next === 'white' || next === 'dark' || next === 'system') setPreference(next)
      }}
    >
      {options.map(({ id, label, Icon }) => (
        <ToggleGroupItem
          key={id}
          aria-label={label}
          aria-pressed={preference === id}
          className="h-8 w-8 px-0"
          title={label}
          value={id}
        >
          <Icon className="size-4" />
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
