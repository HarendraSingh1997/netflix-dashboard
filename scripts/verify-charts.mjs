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
await new Promise((resolve) => server.listen(4175, resolve))

const browser = await chromium.launch()
const page = await browser.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })

await page.goto('http://localhost:4175/')
await page.setInputFiles('input[type=file]', EXPORT)
await page.getByText('Your time on Netflix').waitFor({ timeout: 60000 })
await page.getByRole('heading', { name: 'Watch time over time', exact: true }).waitFor({ timeout: 180000 })
console.log('PASS: large files parsed, overview settled')
console.log('PASS: import completes')

await page.getByRole('navigation', { name: 'Dashboard sections' }).getByRole('button', { name: 'Viewing', exact: true }).click()
await page.getByText('Watch-time trend (all months').waitFor({ timeout: 90000 })
console.log('PASS: trend line chart renders')
await page.getByText('Profile → device flow').waitFor({ timeout: 30000 })
console.log('PASS: sankey chart renders')

await page.getByRole('button', { name: /View all \w+ sessions/ }).first().click()
await page.getByRole('dialog').waitFor({ timeout: 20000 })
console.log('PASS: heatmap row opens drill-down dialog')
await page.getByRole('button', { name: 'Close', exact: true }).click()

await page.getByRole('button', { name: 'Full screen: Monthly watch-time trend' }).click()
await page.getByRole('dialog').waitFor({ timeout: 20000 })
console.log('PASS: chart fullscreen opens')
await page.getByRole('button', { name: 'Close', exact: true }).click()

await page.getByRole('navigation', { name: 'Dashboard sections' }).getByRole('button', { name: 'Discovery', exact: true }).click()
await page.getByText('Search funnel (all events').waitFor({ timeout: 90000 })
console.log('PASS: funnel chart renders')

const bodyText = await page.textContent('body')
for (const cap of ['Showing latest 100', 'Showing 60 of', 'Showing 40 of', 'Showing 36 of']) {
  if (bodyText.includes(cap)) throw new Error(`Data still sliced: "${cap}"`)
}
console.log('PASS: no sliced-data caps')

await browser.close()
server.close()
if (errors.length) { console.error('JS errors:', errors); process.exit(1) }
console.log('PASS: no console or page errors')
