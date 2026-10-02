import { pixelBasedPreset, type TailwindConfig } from '@react-email/components'

export const proofTailwind: TailwindConfig = {
  presets: [pixelBasedPreset],
  theme: {
    extend: {
      colors: {
        brand: '#E1251B',
      },
    },
  },
}
