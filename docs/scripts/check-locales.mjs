import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// The documentation site is a complete bilingual mirror: every Markdown page
// under the mirrored trees has a Simplified Chinese counterpart at the same
// relative path, and every Chinese page has an English source. This gate
// verifies coverage in both directions and the minimum fidelity of each pair.

const docsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const mirroredTrees = ['spec', 'adr', 'project', 'guide']
const mirroredRootFiles = ['plugin-development.md', 'README.md']

function markdownFiles(relativeDirectory) {
  const absolute = path.join(docsRoot, relativeDirectory)
  const files = []
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name)
      if (entry.isDirectory()) visit(entryPath)
      else if (entry.name.endsWith('.md')) {
        files.push(path.relative(absolute, entryPath).split(path.sep).join('/'))
      }
    }
  }
  if (fs.existsSync(absolute)) visit(absolute)
  return files.sort()
}

function mirroredFiles(root) {
  const files = []
  for (const tree of mirroredTrees) {
    for (const file of markdownFiles(path.posix.join(root, tree))) files.push(`${tree}/${file}`)
  }
  for (const file of mirroredRootFiles) {
    if (fs.existsSync(path.join(docsRoot, root, file))) files.push(file)
  }
  return files.sort()
}

// `index.md` becomes the directory route; `README.md` keeps its name.
function routeFor(relativePath) {
  return `/${relativePath.replace(/\.md$/, '').replace(/\/index$/, '/')}`
}

function proseStats(source) {
  let fence = null
  let fences = 0
  const tableRows = []
  for (const line of source.split('\n')) {
    const marker = line.match(/^\s*(```|~~~)/)
    if (marker) {
      fence = fence ? null : marker[1]
      fences += 1
      continue
    }
    if (fence) continue
    const trimmed = line.trim()
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      tableRows.push([...trimmed].filter((character) => character === '|').length)
    }
  }
  return { fences, tableRows }
}

const englishFiles = mirroredFiles('')
const chineseFiles = mirroredFiles('zh-CN')
const englishSet = new Set(englishFiles)
const chineseSet = new Set(chineseFiles)

const chineseRoutes = new Set()
for (const file of chineseFiles) chineseRoutes.add(`/zh-CN${routeFor(file)}`.replace(/\/$/, ''))

const missingChinese = englishFiles.filter((file) => !chineseSet.has(file))
const missingEnglish = chineseFiles.filter((file) => !englishSet.has(file))

const invalid = []
const danglingLinks = []

for (const relativePath of englishFiles) {
  if (!chineseSet.has(relativePath)) continue
  const englishSource = fs.readFileSync(path.join(docsRoot, relativePath), 'utf8')
  const chineseSource = fs.readFileSync(path.join(docsRoot, 'zh-CN', relativePath), 'utf8')
  const englishRoute = routeFor(relativePath)

  const reasons = []
  if (!/^#\s+\S+/m.test(chineseSource)) reasons.push('missing top-level heading')
  if (!/[\u3400-\u9fff]/.test(chineseSource)) reasons.push('no Chinese prose')
  if (!chineseSource.includes(`](${englishRoute})`)) reasons.push(`missing link to English source ${englishRoute}`)
  if (chineseSource.includes('PIHOLDTOKEN')) reasons.push('untranslated placeholder token')

  const englishStats = proseStats(englishSource)
  const chineseStats = proseStats(chineseSource)
  if (englishStats.fences !== chineseStats.fences) {
    reasons.push(`fenced code blocks ${englishStats.fences} -> ${chineseStats.fences}`)
  }
  if (englishStats.tableRows.length !== chineseStats.tableRows.length) {
    reasons.push(`table rows ${englishStats.tableRows.length} -> ${chineseStats.tableRows.length}`)
  } else if (englishStats.tableRows.some((cells, index) => cells !== chineseStats.tableRows[index])) {
    reasons.push('table row cell counts differ')
  }
  if (reasons.length) invalid.push(`${relativePath}: ${reasons.join('; ')}`)

  for (const match of chineseSource.matchAll(/\]\((\/zh-CN\/[^)\s#?]+)/g)) {
    const target = match[1].replace(/\/$/, '')
    if (target.endsWith('.md')) {
      danglingLinks.push(`${relativePath}: link keeps .md suffix (${match[1]})`)
      continue
    }
    if (/\.[a-z0-9]{2,5}$/i.test(target)) continue
    if (!chineseRoutes.has(target)) danglingLinks.push(`${relativePath}: dangling Chinese link (${match[1]})`)
  }
}

if (missingChinese.length || missingEnglish.length || invalid.length || danglingLinks.length) {
  if (missingChinese.length) console.error(`Missing Chinese mirrors:\n${missingChinese.join('\n')}`)
  if (missingEnglish.length) console.error(`Missing English sources:\n${missingEnglish.join('\n')}`)
  if (invalid.length) console.error(`Invalid Chinese mirrors:\n${invalid.join('\n')}`)
  if (danglingLinks.length) console.error(`Dangling Chinese links:\n${danglingLinks.join('\n')}`)
  process.exitCode = 1
} else {
  console.log(`Verified ${englishFiles.length} English/Chinese documentation pairs (${chineseFiles.length} Chinese pages).`)
}
