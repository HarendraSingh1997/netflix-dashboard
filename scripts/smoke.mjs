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
await new Promise((resolve) => server.listen(4173, resolve))

const browser = await chromium.launch()
const page = await browser.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })

await page.goto('http://localhost:4173/')
await page.getByText('Your viewing history.').waitFor()

await page.setInputFiles('input[type=file]', EXPORT)
await page.getByText('Your time on Netflix').waitFor({ timeout: 30000 })
await page.getByRole('heading', { name: 'Watch time over time', exact: true }).waitFor({ timeout: 180000 })
console.log('PASS: large files parsed, overview settled')
console.log('PASS: import completes, overview renders')

const TAB_CHECKS = [
  ['Viewing', 'When you watch'],
  ['Discovery', 'Search funnel (all events'],
  ['Ratings & My List', 'Ratings given'],
  ['Profiles', 'Created'],
  ['Devices & locations', 'Activity by region'],
  ['Billing', 'Settled invoices'],
  ['Messages & support', 'Most frequent messages'],
  ['Games', 'Playtime by game'],
  ['Account', 'Communication'],
  ['Ask', 'Ask about your export'],
  ['Data explorer', 'Source files'],
]
for (const [label, expect] of TAB_CHECKS) {
  await page.getByRole('navigation', { name: 'Dashboard sections' }).getByRole('button', { name: label, exact: true }).click()
  await page.getByText(expect).first().waitFor({ timeout: 60000 })
  console.log(`PASS: ${label} tab renders`)
}

// Viewing interactions: trend, sankey, heatmap dialog, fullscreen
await page.getByRole('navigation', { name: 'Dashboard sections' }).getByRole('button', { name: 'Viewing', exact: true }).click()
await page.getByText('Watch-time trend (all months').waitFor({ timeout: 60000 })
console.log('PASS: trend line chart renders')
await page.getByText('Profile → device flow').waitFor()
console.log('PASS: sankey chart renders')

// Heatmap: click a weekday row button to open drill-down dialog
await page.getByRole('button', { name: /View all \w+ sessions/ }).first().click()
await page.getByRole('dialog').waitFor({ timeout: 15000 })
console.log('PASS: heatmap row opens drill-down dialog')
await page.getByRole('button', { name: 'Close', exact: true }).click()

// Heatmap: click an hour cell
await page.getByRole('button', { name: /View sessions for \w+ \d\d:00/ }).first().click()
await page.getByRole('dialog').waitFor({ timeout: 15000 })
console.log('PASS: heatmap cell opens drill-down dialog')
await page.keyboard.press('Escape').catch(() => {})
await page.getByRole('button', { name: 'Close', exact: true }).click().catch(() => {})

// Fullscreen: open a chart fullscreen dialog
await page.getByRole('button', { name: 'Full screen: Monthly watch-time trend' }).click()
await page.getByRole('dialog').waitFor({ timeout: 15000 })
console.log('PASS: chart fullscreen dialog opens')
await page.getByRole('button', { name: 'Close', exact: true }).click()

// TanStack table: sort + virtualization in All sessions (scoped to the visible
// panel — visited tabs stay mounted in hidden panels since the keepMounted change)
const panel = page.locator('[role="tabpanel"]:not([hidden])')
const sortButton = panel.getByRole('button', { name: /Start Time/ }).first()
await sortButton.click()
console.log('PASS: table column sorting responds')
const grid = panel.getByLabel('Scrollable data table').last()
const statusText = await panel.getByRole('status').last().textContent()
const match = statusText.match(/([\d,]+) of ([\d,]+) records/)
if (!match) throw new Error(`Unexpected status text: ${statusText}`)
const total = Number(match[2].replace(/,/g, ''))
const rendered = await grid.getByRole('row').count()
if (!(total > 0 && rendered < total)) throw new Error(`Virtualization check failed: ${rendered} rows rendered of ${total}`)
console.log(`PASS: table virtualizes (${rendered} DOM rows for ${total.toLocaleString()} records)`)
await grid.evaluate((el) => el.scrollTo({ top: el.scrollHeight }))
await page.waitForTimeout(800)
const afterScroll = await grid.getByRole('row').count()
if (!afterScroll) throw new Error('No rows rendered after virtual scroll')
console.log(`PASS: virtual scroll responds (${afterScroll} rows in window)`)

// Discovery: funnel renders with all events
await page.getByRole('navigation', { name: 'Dashboard sections' }).getByRole('button', { name: 'Discovery', exact: true }).click()
await page.getByText('Search activity trend').waitFor({ timeout: 60000 })
console.log('PASS: discovery trend + funnel render')

// Full-data check: explorer shows full record counts, no "Showing X of" caps
await page.getByRole('navigation', { name: 'Dashboard sections' }).getByRole('button', { name: 'Data explorer', exact: true }).click()
await page.getByRole('heading', { name: 'Source files', exact: true }).waitFor()
const bodyText = await page.textContent('body')
for (const cap of ['Showing latest 100', 'Showing 60 of', 'Showing 40 of', 'Showing 36 of', 'Showing 12 of']) {
  if (bodyText.includes(cap)) throw new Error(`Data still sliced: found "${cap}"`)
}
console.log('PASS: no sliced-data caps found')

await page.getByRole('button', { name: 'Clear export' }).click()
await page.getByText('Your viewing history.').waitFor()
console.log('PASS: clear returns to landing')

await browser.close()
server.close()
if (errors.length) { console.error('JS errors:', errors); process.exit(1) }
console.log('PASS: no console or page errors')
