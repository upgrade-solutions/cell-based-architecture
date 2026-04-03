import * as fs from 'fs'
import * as path from 'path'
import { DnaValidator } from './validator'

const [, , filePath, schemaId] = process.argv

if (!filePath || !schemaId) {
  console.error('Usage: ts-node src/cli.ts <path-to-dna.json> <schema-id>')
  console.error('Example: ts-node src/cli.ts operational/dna/loan.json operational/noun')
  process.exit(1)
}

const validator = new DnaValidator()
const doc = JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf-8'))
const result = validator.validate(doc, schemaId)

if (result.valid) {
  console.log(`✓ Valid ${schemaId}`)
} else {
  console.error(`✗ Invalid ${schemaId}`)
  for (const error of result.errors) {
    console.error(`  ${error.instancePath || '/'} ${error.message}`)
  }
  process.exit(1)
}
