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
await new Promise((resolve) => server.listen(4177, resolve))

const browser = await chromium.launch()
for (const width of [1440, 390]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } })
  await page.goto('http://localhost:4177/')
  await page.screenshot({ path: `screenshots/landing-${width}.png` })
  await page.setInputFiles('input[type=file]', EXPORT)
  // Desktop shows the sidebar; mobile hides it behind the drawer button.
  await Promise.race([
    page.getByRole('navigation', { name: 'Dashboard sections' }).waitFor({ timeout: 60000 }),
    page.getByRole('button', { name: 'Open navigation' }).waitFor({ timeout: 60000 }),
  ])
  await page.waitForTimeout(9000)
  await page.screenshot({ path: `screenshots/overview-${width}.png`, fullPage: false })
  if (await page.getByRole('button', { name: 'Open navigation' }).isVisible()) {
    await page.getByRole('button', { name: 'Open navigation' }).click()
    await page.getByRole('dialog', { name: 'Dashboard navigation' }).getByRole('button', { name: 'Viewing', exact: true }).click()
  } else {
    await page.getByRole('navigation', { name: 'Dashboard sections' }).getByRole('button', { name: 'Viewing', exact: true }).click()
  }
  await page.getByText('Watch-time trend (all months').waitFor({ timeout: 90000 })
  await page.waitForTimeout(4000)
  await page.screenshot({ path: `screenshots/viewing-${width}.png`, fullPage: false })
  await page.close()
  console.log(`PASS: screenshots at ${width}px`)
}
await browser.close()
server.close()
