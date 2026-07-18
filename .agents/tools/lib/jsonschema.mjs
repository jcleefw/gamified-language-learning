// .agents/tools/lib/jsonschema.mjs
// Zero-dependency validator for a JSON-Schema subset: $ref, type, required,
// properties, additionalProperties, items, enum, pattern, minLength, minimum.
// Anything outside this subset is ignored — keep schema.json within it.
//
// Usage (library):
//   import { validate } from './lib/jsonschema.mjs'
//   const errors = validate(data, schema)   // [] when valid
//
// Usage (CLI):
//   node .agents/tools/lib/jsonschema.mjs <schema.json> <data.json>
//   cat data.json | node .agents/tools/lib/jsonschema.mjs <schema.json> -
//   exit 0 = valid, exit 1 = invalid (errors on stderr), exit 2 = bad usage

import { readFileSync } from 'node:fs'

function resolveRef(ref, root) {
  if (!ref.startsWith('#/')) throw new Error(`Unsupported $ref (local only): ${ref}`)
  return ref
    .slice(2)
    .split('/')
    .reduce((node, key) => {
      if (node == null) throw new Error(`Unresolvable $ref: ${ref}`)
      return node[key]
    }, root)
}

function typeOf(value) {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  if (Number.isInteger(value)) return 'integer'
  return typeof value // 'string' | 'number' | 'boolean' | 'object'
}

function matchesType(value, allowed) {
  const t = typeOf(value)
  const list = Array.isArray(allowed) ? allowed : [allowed]
  // JSON has no distinct integer type; an integer also satisfies `number`.
  return list.some((a) => a === t || (a === 'number' && t === 'integer'))
}

/**
 * @returns {string[]} list of validation error messages ([] when valid)
 */
export function validate(data, schema, root = schema, path = '$') {
  const errors = []

  if (schema.$ref) {
    return validate(data, resolveRef(schema.$ref, root), root, path)
  }

  if (schema.type && !matchesType(data, schema.type)) {
    errors.push(`${path}: expected type ${JSON.stringify(schema.type)}, got ${typeOf(data)}`)
    return errors // type mismatch — deeper checks would be noise
  }

  if (schema.enum && !schema.enum.some((v) => v === data)) {
    errors.push(`${path}: value ${JSON.stringify(data)} not in enum ${JSON.stringify(schema.enum)}`)
  }

  if (typeof data === 'string') {
    if (schema.pattern && !new RegExp(schema.pattern).test(data)) {
      errors.push(`${path}: "${data}" does not match pattern /${schema.pattern}/`)
    }
    if (schema.minLength != null && data.length < schema.minLength) {
      errors.push(`${path}: string shorter than minLength ${schema.minLength}`)
    }
  }

  if (typeof data === 'number' && schema.minimum != null && data < schema.minimum) {
    errors.push(`${path}: ${data} is below minimum ${schema.minimum}`)
  }

  if (typeOf(data) === 'array' && schema.items) {
    data.forEach((item, i) => errors.push(...validate(item, schema.items, root, `${path}[${i}]`)))
  }

  if (typeOf(data) === 'object') {
    for (const key of schema.required ?? []) {
      if (!Object.prototype.hasOwnProperty.call(data, key)) {
        errors.push(`${path}: missing required property "${key}"`)
      }
    }
    for (const [key, value] of Object.entries(data)) {
      const propSchema = schema.properties?.[key]
      if (propSchema) {
        errors.push(...validate(value, propSchema, root, `${path}.${key}`))
      } else if (schema.additionalProperties === false) {
        errors.push(`${path}: unexpected property "${key}"`)
      } else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
        errors.push(...validate(value, schema.additionalProperties, root, `${path}.${key}`))
      }
    }
  }

  return errors
}

// ── CLI ─────────────────────────────────────────────────────────────────────
if (import.meta.url === `file://${process.argv[1]}`) {
  const [schemaPath, dataPath] = process.argv.slice(2)
  if (!schemaPath || !dataPath) {
    console.error('usage: node jsonschema.mjs <schema.json> <data.json|->')
    process.exit(2)
  }
  try {
    const schema = JSON.parse(readFileSync(schemaPath, 'utf8'))
    const raw = dataPath === '-' ? readFileSync(0, 'utf8') : readFileSync(dataPath, 'utf8')
    const data = JSON.parse(raw)
    const errors = validate(data, schema)
    if (errors.length) {
      console.error(`✗ ${dataPath} is INVALID against ${schemaPath}:`)
      for (const e of errors) console.error(`  - ${e}`)
      process.exit(1)
    }
    console.error(`✓ ${dataPath} valid against ${schemaPath}`)
    process.exit(0)
  } catch (err) {
    console.error(`✗ ${err.message}`)
    process.exit(2)
  }
}
