// Writes small test assets: SVG backgrounds and sprites, a WAV tone for music and a WAV knock for a sound, and one file matching nothing.
import { mkdirSync, writeFileSync } from 'node:fs'

const [, , outputDirectory] = process.argv
mkdirSync(outputDirectory, { recursive: true })

const classroom = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080">
  <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4a261"/><stop offset="1" stop-color="#7a3b2e"/></linearGradient></defs>
  <rect width="1920" height="1080" fill="#3b2a24"/>
  <rect x="160" y="120" width="700" height="480" fill="url(#sky)" stroke="#2a1d18" stroke-width="24"/>
  <rect x="1060" y="120" width="700" height="480" fill="url(#sky)" stroke="#2a1d18" stroke-width="24"/>
  <rect x="0" y="760" width="1920" height="320" fill="#5a4034"/>
  ${[200, 760, 1320].map(x => `<rect x="${x}" y="700" width="400" height="40" fill="#8a6a52"/><rect x="${x + 20}" y="740" width="20" height="200" fill="#6b5040"/><rect x="${x + 360}" y="740" width="20" height="200" fill="#6b5040"/>`).join('')}
</svg>`

const rooftop = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080">
  <defs><linearGradient id="dusk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d2b53"/><stop offset="1" stop-color="#7e2553"/></linearGradient></defs>
  <rect width="1920" height="1080" fill="url(#dusk)"/>
  ${Array.from({ length: 14 }, (_, index) => {
    const width = 110 + (index * 37) % 90
    const height = 260 + (index * 113) % 380
    const x = index * 140
    const windows = Array.from({ length: 12 }, (_, windowIndex) => (index + windowIndex) % 3 === 0
      ? `<rect x="${x + 20 + (windowIndex % 3) * 30}" y="${1080 - height + 30 + Math.floor(windowIndex / 3) * 50}" width="16" height="22" fill="#ffd166"/>` : '').join('')
    return `<rect x="${x}" y="${1080 - height}" width="${width}" height="${height}" fill="#0b1026"/>${windows}`
  }).join('')}
  <rect x="0" y="900" width="1920" height="180" fill="#2b2d42"/>
  <rect x="0" y="880" width="1920" height="24" fill="#8d99ae"/>
</svg>`

const MOUTHS = {
  normal: 'M 270 330 Q 300 345 330 330',
  smile: 'M 260 320 Q 300 370 340 320',
  surprised: 'M 290 330 a 12 16 0 1 0 24 0 a 12 16 0 1 0 -24 0',
  worried: 'M 265 345 Q 300 320 335 345',
}

const sprite = (mouth, hair = '#5c3d2e', body = '#3d5a80') => `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="960">
  <path d="M 120 960 Q 120 520 300 500 Q 480 520 480 960 Z" fill="${body}"/>
  <rect x="270" y="400" width="60" height="120" fill="#f2c6a0"/>
  <ellipse cx="300" cy="280" rx="130" ry="150" fill="#f2c6a0"/>
  <path d="M 160 260 Q 170 110 300 110 Q 430 110 440 260 Q 420 170 300 170 Q 180 170 160 260 Z" fill="${hair}"/>
  <path d="M 160 260 Q 140 420 190 480 L 200 270 Z M 440 260 Q 460 420 410 480 L 400 270 Z" fill="${hair}"/>
  <rect x="175" y="150" width="60" height="22" rx="8" fill="#e63946" transform="rotate(-20 205 161)"/>
  <ellipse cx="268" cy="270" rx="14" ry="18" fill="#22223b"/>
  <ellipse cx="368" cy="270" rx="14" ry="18" fill="#22223b"/>
  <path d="${mouth}" stroke="#7a2e2e" stroke-width="8" fill="none" stroke-linecap="round"/>
</svg>`

writeFileSync(`${outputDirectory}/classroom_evening.svg`, classroom)
writeFileSync(`${outputDirectory}/Rooftop.svg`, rooftop)
writeFileSync(`${outputDirectory}/marie.svg`, sprite(MOUTHS.normal))
writeFileSync(`${outputDirectory}/Marie-Smile.svg`, sprite(MOUTHS.smile))
writeFileSync(`${outputDirectory}/marie_surprised.svg`, sprite(MOUTHS.surprised))
writeFileSync(`${outputDirectory}/marie-worried.svg`, sprite(MOUTHS.worried))
writeFileSync(`${outputDirectory}/street.svg`, classroom)
writeFileSync(`${outputDirectory}/jules.svg`, sprite(MOUTHS.smile, '#1b1b1b', '#6a994e'))

/** A 16-bit mono WAV of the given length, each sample from its time in seconds. */
function wav(seconds, sampleAt) {
  const sampleRate = 22050
  const samples = new Int16Array(Math.round(sampleRate * seconds))
  samples.forEach((_, index) => {
    samples[index] = Math.round(sampleAt(index / sampleRate) * 3000)
  })
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + samples.byteLength, 4)
  header.write('WAVEfmt ', 8)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(sampleRate * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(samples.byteLength, 40)
  return Buffer.concat([header, Buffer.from(samples.buffer)])
}

// A quiet 220 Hz tone for music, and a short fading knock for a sound effect.
writeFileSync(`${outputDirectory}/calm.wav`, wav(1, time => Math.sin(2 * Math.PI * 220 * time)))
writeFileSync(`${outputDirectory}/door.wav`, wav(0.3, time => Math.sin(2 * Math.PI * 90 * time) * Math.exp(-time * 12)))
console.log('assets written')
