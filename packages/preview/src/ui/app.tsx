import { useEffect, useState } from 'react'

import { TooltipProvider } from '@/components/ui/tooltip'

import { createPreviewClient } from './client/preview-client'
import { PreviewProvider } from './client/preview-context'
import { Workbench } from './layout/workbench'
import { PrefsProvider } from './prefs/prefs-context'

export function App() {
  const [client] = useState(createPreviewClient)
  useEffect(() => client.connect(), [client])
  return (
    <TooltipProvider delay={400}>
      <PreviewProvider client={client}>
        <PrefsProvider storage={window.localStorage}>
          <Workbench />
        </PrefsProvider>
      </PreviewProvider>
    </TooltipProvider>
  )
}
