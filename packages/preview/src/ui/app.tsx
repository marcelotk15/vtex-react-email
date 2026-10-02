import { useEffect, useState } from 'react'

import { TooltipProvider } from '@/components/ui/tooltip'

import { createPreviewClient } from './client/preview-client'
import { PreviewProvider } from './client/preview-context'
import { PrefsProvider } from './prefs/prefs-context'
import { ThemeProvider } from './theme/theme-context'
import { Workbench } from './workbench/workbench'

export function App() {
  const [client] = useState(createPreviewClient)
  useEffect(() => client.connect(), [client])
  return (
    <TooltipProvider delay={400}>
      <ThemeProvider storage={window.localStorage}>
        <PreviewProvider client={client}>
          <PrefsProvider storage={window.localStorage}>
            <Workbench />
          </PrefsProvider>
        </PreviewProvider>
      </ThemeProvider>
    </TooltipProvider>
  )
}
