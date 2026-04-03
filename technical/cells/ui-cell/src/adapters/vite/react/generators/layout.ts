import { Layout, Route } from '../../../../types'
import { toTitleCase } from '../../../../utils'

interface NavItem {
  label: string
  path: string
}

function buildNavItems(routes: Route[]): NavItem[] {
  const seen = new Set<string>()
  const items: NavItem[] = []
  for (const route of routes) {
    if (!seen.has(route.path)) {
      seen.add(route.path)
      items.push({ label: toTitleCase(route.page), path: route.path })
    }
  }
  return items
}

export function generateLayout(layout: Layout, routes: Route[]): string {
  const navItems = buildNavItems(routes)

  if (layout.type === 'sidebar') {
    return generateSidebarLayout(layout.name, navItems)
  }
  return generateFullWidthLayout(layout.name, navItems)
}

function generateSidebarLayout(name: string, navItems: NavItem[]): string {
  const navLiteral = navItems
    .map(n => `  { label: '${n.label}', path: '${n.path}' }`)
    .join(',\n')

  return `import { NavLink, Outlet } from 'react-router-dom'

const NAV = [
${navLiteral},
]

export default function ${name}() {
  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      <nav
        style={{
          width: 240,
          borderRight: '1px solid #e5e7eb',
          padding: '1.5rem 1rem',
          background: '#f9fafb',
          flexShrink: 0,
        }}
      >
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {NAV.map(item => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                style={({ isActive }) => ({
                  display: 'block',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '0.375rem',
                  textDecoration: 'none',
                  fontSize: '0.875rem',
                  color: isActive ? '#1d4ed8' : '#374151',
                  background: isActive ? '#eff6ff' : 'transparent',
                  fontWeight: isActive ? 600 : 400,
                })}
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <main style={{ flex: 1, padding: '2rem', overflow: 'auto' }}>
        <Outlet />
      </main>
    </div>
  )
}
`
}

function generateFullWidthLayout(name: string, navItems: NavItem[]): string {
  const navLiteral = navItems
    .map(n => `  { label: '${n.label}', path: '${n.path}' }`)
    .join(',\n')

  return `import { NavLink, Outlet } from 'react-router-dom'

const NAV = [
${navLiteral},
]

export default function ${name}() {
  return (
    <div style={{ minHeight: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ borderBottom: '1px solid #e5e7eb', background: '#fff', padding: '0 2rem' }}>
        <nav style={{ display: 'flex', gap: '0.25rem', height: 56, alignItems: 'center' }}>
          {NAV.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              style={({ isActive }) => ({
                padding: '0.5rem 0.75rem',
                borderRadius: '0.375rem',
                textDecoration: 'none',
                fontSize: '0.875rem',
                color: isActive ? '#1d4ed8' : '#374151',
                background: isActive ? '#eff6ff' : 'transparent',
                fontWeight: isActive ? 600 : 400,
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem' }}>
        <Outlet />
      </main>
    </div>
  )
}
`
}
