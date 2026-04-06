interface LayoutProps {
  toolbar: React.ReactNode
  canvas: React.ReactNode
  sidebar: React.ReactNode
}

export function Layout({ toolbar, canvas, sidebar }: LayoutProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh' }}>
      {toolbar}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          {canvas}
        </div>
        {sidebar}
      </div>
    </div>
  )
}
