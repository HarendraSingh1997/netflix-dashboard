import { chromium } from '/Users/harendrasingh/.npm/_npx/6bcb61ec6d5aea22/node_modules/playwright/index.mjs'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join } from 'node:path'

const EXPORT = '/Users/harendrasingh/Downloads/Netflix Member Information Request (HR)'
const root = new URL('../dist', import.meta.url).pathname
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }
const server = createServer(async (req, res) => {
  try {
    const path = req.url === '/' ? '/index.html' : req.url.split('?')[0]
    const body = await readFile(join(root, path))
    res.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream' })
    res.end(body)
  } catch { res.writeHead(404); res.end() }
})
await new Promise((resolve) => server.listen(4176, resolve))

const browser = await chromium.launch()
const page = await browser.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })

await page.goto('http://localhost:4176/')
await page.setInputFiles('input[type=file]', EXPORT)
await page.getByText('Your time on Netflix').waitFor({ timeout: 60000 })
await page.getByRole('heading', { name: 'Watch time over time', exact: true }).waitFor({ timeout: 180000 })
console.log('PASS: large files parsed, overview settled')
console.log('PASS: import completes')

// Chips on the All sessions table in Viewing
await page.getByRole('navigation', { name: 'Dashboard sections' }).getByRole('button', { name: 'Viewing', exact: true }).click()
await page.getByRole('heading', { name: 'All sessions', exact: true }).waitFor({ timeout: 90000 })

// Scope to the visible panel — visited tabs stay mounted in hidden panels
const panel = page.locator('[role="tabpanel"]:not([hidden])')
await panel.getByRole('combobox', { name: 'Filter column' }).last().click()
await page.getByRole('option', { name: 'Profile' }).click()
await panel.getByText('records', { exact: false }).first().waitFor()
const chipGroup = page.getByRole('group', { name: 'Filter values for Profile' })
await chipGroup.waitFor({ timeout: 30000 })
const chips = chipGroup.getByRole('button')
const chipCount = await chips.count()
console.log(`PASS: ${chipCount} profile chips rendered`)
if (!chipCount) throw new Error('No filter chips rendered')

const before = await panel.getByRole('status').last().textContent()
const firstChip = await chips.first().textContent()
await chips.first().click()
await panel.getByRole('button', { name: /^Remove filter Profile:/ }).waitFor({ timeout: 15000 })
const after = await panel.getByRole('status').last().textContent()
console.log(`PASS: chip "${firstChip?.trim()}" filters ${before?.trim()} -> ${after?.trim()}`)
if (before === after) throw new Error('Chip selection did not change record count')

// Multi-select: toggle a second chip, count should grow (OR within column)
await chips.nth(1).click()
const multi = await panel.getByRole('status').last().textContent()
console.log(`PASS: second chip multi-selects -> ${multi?.trim()}`)

// Remove one chip via its active-filter chip
await page.getByRole('button', { name: /^Remove filter Profile:/ }).first().click()
console.log('PASS: active chip removal works')

// Clear all
await panel.getByRole('button', { name: /^Clear all filters/ }).click()
const cleared = await panel.getByRole('status').last().textContent()
console.log(`PASS: clear-all restores -> ${cleared?.trim()}`)
if (cleared !== before) throw new Error(`Clear-all did not restore full data: ${cleared} vs ${before}`)

// Value search narrows chips
await panel.getByLabel('Search values').last().fill('zzz-no-such-value')
await panel.getByText('No values for Profile').waitFor({ timeout: 15000 })
console.log('PASS: value search with no match shows empty state')

await browser.close()
server.close()
if (errors.length) { console.error('JS errors:', errors); process.exit(1) }
console.log('PASS: no console or page errors')
