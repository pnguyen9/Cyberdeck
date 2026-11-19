// The layers of the stage in the preview, sampled frame by frame: an illustration covers the characters,
// whatever their depth; a fade between backgrounds and a transition through black play out over their
// time, the tint's own transition aside; and what the story changes after a fade out appears only once
// the screen is covered.
import { createProjectWithStory, middleOf, pause, shownStep } from './harness.mjs'

const STORY = `[bg: rooftop] [enter: marie center]
Marie stands on the roof.
[illustration: Sunrise]
The sun covers everything.
[exit: marie]
Marie is gone, behind it.
[illustration: none]
[transition: fade 2s] [bg: street]
A slow fade to the street.
[transition: black 2s] [bg: rooftop]
Through black, back to the roof.
[fade out: 2s]
[bg: street]
In the dark.`

/** The average colour, [r, g, b], of what the page shows inside `clip`. */
async function colourIn(page, clip) {
  const png = await page.capture(clip)
  return page.evaluate(`(async () => {
    const image = new Image()
    image.src = 'data:image/png;base64,${png}'
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    const context = canvas.getContext('2d')
    context.drawImage(image, 0, 0)
    const pixels = context.getImageData(0, 0, image.width, image.height).data
    const sums = [0, 0, 0]
    for (let index = 0; index < pixels.length; index += 4) {
      sums[0] += pixels[index]
      sums[1] += pixels[index + 1]
      sums[2] += pixels[index + 2]
    }
    return sums.map(sum => Math.round(sum / (pixels.length / 4)))
  })()`)
}

/** A square of `size` pixels around a point, to capture. */
const squareAround = ({ x, y }, size) => ({ x: x - size / 2, y: y - size / 2, width: size, height: size })

const brightness = colour => colour[0] + colour[1] + colour[2]
const distance = (one, other) => one.reduce((sum, value, index) => sum + Math.abs(value - other[index]), 0)

/** Each background element of the stage: its inline background, and the opacity it is drawn with now. */
const backgrounds = page => page.evaluate(`[...document.querySelectorAll('.viewport .stage > .background')].map(element => ({ style: element.style.background, opacity: Number(getComputedStyle(element).opacity) }))`)

export default async function check(page, { url }) {
  await createProjectWithStory(page, url, 'Layers', STORY)
  page.check('the import accepts the story', await page.evaluate(`document.querySelectorAll('.problems li').length`), 0)
  await page.clickButton('Preview ▶', '.button')
  await page.waitFor('.viewport .character .silhouette')
  await pause(1500)

  /** A small square of the stage, at fractions of its width and height. */
  const stageClip = async (x, y) => squareAround(await page.evaluate(`(() => {
    const box = document.querySelector('.viewport .stage').getBoundingClientRect()
    return { x: box.x + box.width * ${x}, y: box.y + box.height * ${y} }
  })()`), 10)
  /** Advances one page: presses, then polls closely until the text shown changes, and returns the moment it did. */
  const advance = async () => {
    const before = await shownStep(page)
    await page.press(' ')
    const deadline = Date.now() + 5000
    while (await shownStep(page) === before) {
      if (Date.now() > deadline) {
        throw new Error(`The page stayed on ${JSON.stringify(before)} 5 s after pressing Space`)
      }
      await pause(10)
    }
    return Date.now()
  }
  /** Waits for the typewriter to show the whole page, then for the stage to settle. */
  const settle = async () => {
    await page.waitUntil(`document.querySelector('.viewport .text .not-yet-shown') === null`, 20000)
    await pause(1500)
  }

  // 1. An illustration covers the characters: the square over Marie's silhouette shows the same with her as after she left.
  const silhouette = squareAround(await middleOf(page, '.viewport .character .silhouette'), 20)
  await settle()
  await advance()
  await settle()
  page.check('the illustration is up, Marie still on stage', [await page.evaluate(`!!document.querySelector('.viewport .illustration')`), await page.evaluate(`document.querySelectorAll('.viewport .character').length`)], [true, 1])
  const withMarie = await colourIn(page, silhouette)
  await page.screenshot('illustration-over-marie')
  await advance()
  await settle()
  page.check('Marie has left', await page.evaluate(`document.querySelectorAll('.viewport .character').length`), 0)
  const withoutMarie = await colourIn(page, silhouette)
  page.check('an illustration covers a character standing at a depth: nothing of her shows through', distance(withMarie, withoutMarie) <= 6 ? 'covered' : `shows through: ${JSON.stringify(withMarie)} against ${JSON.stringify(withoutMarie)}`, 'covered')

  // 2. A fade between backgrounds, 2 s, as the illustration goes: the new one comes in over time, never at once.
  const rooftopStyle = (await backgrounds(page))[0]?.style
  let start = await advance()
  const fadeSamples = []
  while (Date.now() - start < 2400) {
    fadeSamples.push({ at: Date.now() - start, backgrounds: await backgrounds(page) })
    await pause(50)
  }
  const midFade = fadeSamples.filter(sample => sample.backgrounds.some(drawn => drawn.style !== rooftopStyle && drawn.opacity > 0.05 && drawn.opacity < 0.95))
  page.check('a fade between backgrounds shows the new one half drawn on the way', midFade.length > 0 ? 'fades' : `never half drawn: ${JSON.stringify(fadeSamples.slice(0, 6).map(sample => sample.backgrounds.map(drawn => drawn.opacity)))}`, 'fades')
  await settle()
  page.check('the fade ends on the street alone, fully drawn', (await backgrounds(page)).map(drawn => drawn.opacity), [1])
  const streetStyle = (await backgrounds(page))[0]?.style

  // 3. Through black, 2 s: the street fades out over the first second, the roof fades in over the second.
  const square = await stageClip(0.15, 0.35)
  const street = await colourIn(page, square)
  start = await advance()
  const blackSamples = []
  while (Date.now() - start < 2400) {
    const at = Date.now() - start
    blackSamples.push({ at, colour: at < 600 ? await colourIn(page, square) : null, backgrounds: await backgrounds(page) })
    await pause(30)
  }
  const early = blackSamples.filter(sample => sample.colour !== null)
  page.check('through black, the old background fades out rather than leaving black at once', early.some(sample => brightness(sample.colour) >= brightness(street) / 2) ? 'fades out' : `black at once: ${JSON.stringify(early.map(sample => [sample.at, sample.colour]))} against ${JSON.stringify(street)}`, 'fades out')
  const fadingIn = blackSamples.filter(sample => sample.backgrounds.some(drawn => drawn.style !== streetStyle && drawn.opacity > 0.05 && drawn.opacity < 0.95))
  page.check('through black, the new background fades in rather than appearing at once', fadingIn.length > 0 ? 'fades in' : `at once: ${JSON.stringify(blackSamples.filter(sample => sample.at > 700).slice(0, 8).map(sample => [sample.at, sample.backgrounds.map(drawn => drawn.opacity)]))}`, 'fades in')
  await settle()
  const roof = await colourIn(page, square)
  page.check('the roof drawn again', [distance(roof, street) > 20, (await backgrounds(page)).map(drawn => drawn.style === rooftopStyle)], [true, [true]])

  // 4. A fade out, 2 s, then the street: the roof stays drawn under the darkening cover, the street comes only once covered.
  start = await advance()
  const coverSamples = []
  while (Date.now() - start < 1600) {
    coverSamples.push({ at: Date.now() - start, styles: (await backgrounds(page)).map(drawn => drawn.style === rooftopStyle ? 'roof' : drawn.style === streetStyle ? 'street' : drawn.style), cover: await page.evaluate(`getComputedStyle(document.querySelector('.viewport .cover')).opacity`) })
    await pause(50)
  }
  page.check('while the fade out darkens the screen, the old background stays drawn', coverSamples.filter(sample => sample.styles.join() !== 'roof').map(sample => [sample.at, sample.styles, sample.cover]).slice(0, 4), [])
  page.check('the cover was darkening meanwhile, not yet black', coverSamples.some(sample => Number(sample.cover) > 0.1 && Number(sample.cover) < 0.9), true)
  await pause(1500)
  page.check('once covered, the street is drawn under the cover', [await shownStep(page), (await backgrounds(page)).map(drawn => drawn.style === streetStyle ? 'street' : drawn.style)], ['In the dark.', ['street']])
}
