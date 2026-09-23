import { chromium } from '/Users/harendrasingh/.npm/_npx/6bcb61ec6d5aea22/node_modules/playwright/index.mjs'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join } from 'node:path'

const EXPORT = '/Users/harendrasingh/projects/Netflix/Netflix Member Information Request (HR)'
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
await new Promise((resolve) => server.listen(4178, resolve))

// Sidebar label, filename slug, and text that proves the tab finished rendering.
const TABS = [
  ['Overview', 'overview', 'Your time on Netflix'],
  ['Viewing', 'viewing', 'Watch-time trend (all months'],
  ['Discovery', 'discovery', 'Search funnel (all events'],
  ['Ratings & My List', 'ratings', 'Most rated titles'],
  ['Profiles', 'profiles', 'All profile names seen in playback records'],
  ['Devices & locations', 'devices', 'Activity by region'],
  ['Billing', 'billing', 'All invoices'],
  ['Messages & support', 'messages', 'Most frequent messages'],
  ['Games', 'games', 'Playtime by game'],
  ['Account', 'account', 'Communication & privacy preferences'],
  // ['Ask', 'ask', 'Ask about your export'], // Ask tab temporarily disabled
  ['Data explorer', 'explorer', 'Source files'],
]

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto('http://localhost:4178/')
await page.setInputFiles('input[type=file]', EXPORT)
const nav = page.getByRole('navigation', { name: 'Dashboard sections' })
await nav.waitFor({ timeout: 60000 })
await page.waitForTimeout(9000)

for (const [theme, suffix, toggle] of [['dark', '', null], ['light', '-light', 'Switch to light theme']]) {
  if (toggle) {
    await page.getByRole('button', { name: toggle }).click()
    await page.waitForTimeout(800)
  }
  for (const [label, slug, marker] of TABS) {
    await nav.getByRole('button', { name: label, exact: true }).click()
    await page.getByText(marker).first().waitFor({ timeout: 90000 })
    await page.waitForTimeout(2500)
    await page.screenshot({ path: `screenshots/${slug}-1440${suffix}.png`, fullPage: false })
    console.log(`PASS: ${slug}-1440${suffix}.png (${theme})`)
  }
}
await browser.close()
server.close()
