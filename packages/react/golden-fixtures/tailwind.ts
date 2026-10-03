import { pixelBasedPreset, type TailwindConfig } from '@react-email/components'

export const goldenTailwind: TailwindConfig = {
  presets: [pixelBasedPreset],
  theme: {
    extend: {
      colors: {
        brand: '#E1251B',
      },
    },
  },
}
