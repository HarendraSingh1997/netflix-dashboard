import { useState, type ReactNode } from 'react'
import { Maximize2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'

export function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <Dialog
      open
      onOpenChange={(open) => { if (!open) onClose() }}
    >
      <DialogContent
        aria-describedby={undefined}
        className={wide
          ? 'max-h-[92vh] overflow-auto rounded-none border-line bg-panel text-body sm:max-w-[96vw]'
          : 'max-h-[92vh] overflow-auto rounded-none border-line bg-panel text-body sm:max-w-3xl'}
      >
        <DialogHeader>
          <DialogTitle className="display-sm">{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  )
}

export function ChartFrame({ title, children }: { title: string; children: ReactNode | ((fullscreen: boolean) => ReactNode) }) {
  const [fullscreen, setFullscreen] = useState(false)
  const render = (full: boolean) => typeof children === 'function' ? children(full) : children
  return (
    <section className="min-w-0 space-y-6" aria-label={title}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="caption-mono">{title}</h3>
        <button className="icon-btn" aria-label={`Full screen: ${title}`} title={`Full screen: ${title}`} onClick={() => setFullscreen(true)}>
          <Maximize2 className="size-4" aria-hidden="true" />
        </button>
      </div>
      {fullscreen
        ? <Modal title={title} onClose={() => setFullscreen(false)} wide>{render(true)}</Modal>
        : render(false)}
    </section>
  )
}
