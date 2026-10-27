// Copies the screenshots taken by guide-images.check.mjs into the guide: `npm run guide:images`.
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const checksFolder = dirname(fileURLToPath(import.meta.url))
const screenshots = join(checksFolder, 'output', 'guide-images')
const guideImages = join(checksFolder, '..', 'docs', 'guide', 'images')
mkdirSync(guideImages, { recursive: true })
const fileNames = readdirSync(screenshots).filter(fileName => fileName.endsWith('.png'))
for (const fileName of fileNames) {
  copyFileSync(join(screenshots, fileName), join(guideImages, fileName))
}
console.log(`${fileNames.length} screenshots copied into docs/guide/images.`)
