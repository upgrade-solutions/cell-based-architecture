import { ProductUiDNA, Page, Route } from '../../../../types'
import { toFileName } from '../../../../utils'

export function generateRouter(ui: ProductUiDNA): string {
  const { layout, pages, routes } = ui

  const pageImports = pages
    .map(p => `import ${p.name} from './pages/${toFileName(p.name)}'`)
    .join('\n')

  const layoutImport = `import ${layout.name} from './layouts/${toFileName(layout.name)}'`

  const routeElements = routes
    .map(r => routeElement(r, pages))
    .join('\n')

  return `import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
${layoutImport}
${pageImports}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<${layout.name} />}>
          <Route index element={<Navigate to="${routes[0]?.path ?? '/'}" replace />} />
${routeElements}
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
`
}

function routeElement(route: Route, pages: Page[]): string {
  const page = pages.find(p => p.name === route.page)
  if (!page) return `          {/* route ${route.path} references unknown page "${route.page}" */}`
  return `          <Route path="${route.path}" element={<${page.name} />} />`
}
