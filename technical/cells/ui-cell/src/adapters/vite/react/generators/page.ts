import { Page, Block, Field } from '../../../../types'
import { toTitleCase } from '../../../../utils'

export function generatePage(page: Page): string {
  const hasFormBlock = page.blocks.some(b => b.type === 'form')
  const imports = [
    hasFormBlock ? `import { useState } from 'react'` : null,
  ].filter(Boolean)

  const blocks = page.blocks.map(b => renderBlock(b, 2)).join('\n\n')

  return [
    ...imports,
    '',
    `export default function ${page.name}() {`,
    hasFormBlock ? renderFormState(page.blocks) : null,
    `  return (`,
    `    <div>`,
    `      <h1 style={{ marginBottom: '1.5rem', fontSize: '1.5rem', fontWeight: 700 }}>`,
    `        ${toTitleCase(page.name)}`,
    `      </h1>`,
    blocks,
    `    </div>`,
    `  )`,
    `}`,
    '',
  ].filter(s => s !== null).join('\n')
}

// ── Form state ────────────────────────────────────────────────────────────────

function renderFormState(blocks: Block[]): string {
  const formBlocks = blocks.filter(b => b.type === 'form' && b.fields?.length)
  if (!formBlocks.length) return ''

  const lines: string[] = []
  for (const block of formBlocks) {
    const stateVar = `${lcFirst(block.name)}State`
    const fields = block.fields ?? []
    const initial = fields.map(f => `${f.name}: ''`).join(', ')
    lines.push(`  const [${stateVar}, set${block.name}State] = useState({ ${initial} })`)
  }
  return lines.join('\n') + '\n'
}

// ── Block renderers ───────────────────────────────────────────────────────────

function renderBlock(block: Block, indent: number): string {
  const pad = ' '.repeat(indent * 2)
  switch (block.type) {
    case 'form':
      return renderFormBlock(block, pad)
    case 'table':
      return renderTableBlock(block, pad)
    case 'detail':
      return renderDetailBlock(block, pad)
    case 'actions':
      return renderActionsBlock(block, pad)
    case 'empty-state':
      return renderEmptyStateBlock(block, pad)
    default:
      return `${pad}{/* ${block.name}: unknown block type "${block.type}" */}`
  }
}

function renderFormBlock(block: Block, pad: string): string {
  const stateVar = `${lcFirst(block.name)}State`
  const setFn = `set${block.name}State`
  const fields = block.fields ?? []

  const fieldElements = fields.map(f => {
    if (f.type === 'enum' && f.values?.length) {
      const options = f.values.map(v => `${pad}          <option key="${v}" value="${v}">${v}</option>`).join('\n')
      return [
        `${pad}      <div style={{ marginBottom: '1rem' }}>`,
        `${pad}        <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: 500 }}>`,
        `${pad}          ${f.label}`,
        `${pad}        </label>`,
        `${pad}        <select`,
        `${pad}          value={${stateVar}.${f.name}}`,
        `${pad}          onChange={e => ${setFn}(s => ({ ...s, ${f.name}: e.target.value }))}`,
        `${pad}          style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}`,
        `${pad}        >`,
        `${pad}          <option value="">All</option>`,
        options,
        `${pad}        </select>`,
        `${pad}      </div>`,
      ].join('\n')
    }

    const inputType = fieldTypeToHtml(f.type)
    return [
      `${pad}      <div style={{ marginBottom: '1rem' }}>`,
      `${pad}        <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: 500 }}>`,
      `${pad}          ${f.label}${f.required ? ' *' : ''}`,
      `${pad}        </label>`,
      `${pad}        <input`,
      `${pad}          type="${inputType}"`,
      `${pad}          value={${stateVar}.${f.name}}`,
      `${pad}          onChange={e => ${setFn}(s => ({ ...s, ${f.name}: e.target.value }))}`,
      `${pad}          required={${!!f.required}}`,
      `${pad}          style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', boxSizing: 'border-box' }}`,
      `${pad}        />`,
      `${pad}      </div>`,
    ].join('\n')
  }).join('\n')

  return [
    `${pad}{/* ${block.name} — ${block.description ?? block.type} */}`,
    `${pad}<form`,
    `${pad}  onSubmit={e => { e.preventDefault() /* TODO: wire to API */ }}`,
    `${pad}  style={{ marginBottom: '1.5rem' }}`,
    `${pad}>`,
    fieldElements,
    `${pad}  <button`,
    `${pad}    type="submit"`,
    `${pad}    style={{ padding: '0.5rem 1rem', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: '0.375rem', cursor: 'pointer' }}`,
    `${pad}  >`,
    `${pad}    Submit`,
    `${pad}  </button>`,
    `${pad}</form>`,
  ].join('\n')
}

function renderTableBlock(block: Block, pad: string): string {
  const fields = block.fields ?? []
  const thStyle = `{ padding: '0.75rem 1rem', textAlign: 'left' as const, borderBottom: '2px solid #e5e7eb', fontWeight: 600, whiteSpace: 'nowrap' as const }`
  const tdStyle = `{ padding: '0.75rem 1rem', borderBottom: '1px solid #e5e7eb' }`
  const headers = fields.map(f => `${pad}        <th style=${thStyle}>${f.label}</th>`).join('\n')
  const cells = fields.map(f => `${pad}          <td style=${tdStyle}>{String(row.${f.name} ?? '')}</td>`).join('\n')

  return [
    `${pad}{/* ${block.name} — ${block.description ?? block.type} */}`,
    `${pad}<div style={{ overflowX: 'auto', marginBottom: '1.5rem' }}>`,
    `${pad}  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>`,
    `${pad}    <thead>`,
    `${pad}      <tr>`,
    headers,
    `${pad}      </tr>`,
    `${pad}    </thead>`,
    `${pad}    <tbody>`,
    `${pad}      {/* TODO: replace with real data */}`,
    `${pad}      {([] as Record<string, unknown>[]).map((row, i) => (`,
    `${pad}        <tr key={i}>`,
    cells,
    `${pad}        </tr>`,
    `${pad}      ))}`,
    `${pad}    </tbody>`,
    `${pad}  </table>`,
    `${pad}</div>`,
  ].join('\n')
}

function renderDetailBlock(block: Block, pad: string): string {
  const fields = block.fields ?? []
  const rows = fields.map(f =>
    [
      `${pad}      <div style={{ display: 'contents' }}>`,
      `${pad}        <dt style={{ fontWeight: 500, color: '#6b7280', fontSize: '0.875rem' }}>${f.label}</dt>`,
      `${pad}        <dd style={{ margin: 0 }}>{/* TODO: data.${f.name} */}</dd>`,
      `${pad}      </div>`,
    ].join('\n')
  ).join('\n')

  return [
    `${pad}{/* ${block.name} — ${block.description ?? block.type} */}`,
    `${pad}<dl`,
    `${pad}  style={{`,
    `${pad}    display: 'grid',`,
    `${pad}    gridTemplateColumns: '200px 1fr',`,
    `${pad}    gap: '0.75rem 1.5rem',`,
    `${pad}    marginBottom: '1.5rem',`,
    `${pad}    padding: '1.5rem',`,
    `${pad}    border: '1px solid #e5e7eb',`,
    `${pad}    borderRadius: '0.5rem',`,
    `${pad}  }}`,
    `${pad}>`,
    rows,
    `${pad}</dl>`,
  ].join('\n')
}

function renderActionsBlock(block: Block, pad: string): string {
  return [
    `${pad}{/* ${block.name} — ${block.description ?? block.type} */}`,
    `${pad}<div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>`,
    `${pad}  {/* TODO: render contextual actions based on resource state and actor role */}`,
    `${pad}  <button`,
    `${pad}    type="button"`,
    `${pad}    onClick={() => { /* TODO */ }}`,
    `${pad}    style={{ padding: '0.5rem 1rem', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '0.375rem', cursor: 'pointer' }}`,
    `${pad}  >`,
    `${pad}    Approve`,
    `${pad}  </button>`,
    `${pad}  <button`,
    `${pad}    type="button"`,
    `${pad}    onClick={() => { /* TODO */ }}`,
    `${pad}    style={{ padding: '0.5rem 1rem', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '0.375rem', cursor: 'pointer' }}`,
    `${pad}  >`,
    `${pad}    Reject`,
    `${pad}  </button>`,
    `${pad}</div>`,
  ].join('\n')
}

function renderEmptyStateBlock(block: Block, pad: string): string {
  return [
    `${pad}{/* ${block.name} — ${block.description ?? 'empty state'} */}`,
    `${pad}<div`,
    `${pad}  style={{`,
    `${pad}    textAlign: 'center',`,
    `${pad}    padding: '3rem',`,
    `${pad}    color: '#9ca3af',`,
    `${pad}    border: '2px dashed #e5e7eb',`,
    `${pad}    borderRadius: '0.5rem',`,
    `${pad}    marginBottom: '1.5rem',`,
    `${pad}  }}`,
    `${pad}>`,
    `${pad}  <p style={{ margin: 0 }}>No results found.</p>`,
    `${pad}</div>`,
  ].join('\n')
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function lcFirst(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1)
}

function fieldTypeToHtml(type: string): string {
  switch (type) {
    case 'number': return 'number'
    case 'date': return 'date'
    case 'datetime': return 'datetime-local'
    case 'email': return 'email'
    case 'password': return 'password'
    default: return 'text'
  }
}
