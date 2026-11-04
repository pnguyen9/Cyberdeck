// Writes docs/guide/guide.md from docs/guide/index.html: the same guide, readable where HTML is not
// shown as a page (on GitHub, in an editor). `npm run guide:markdown`, also run by `npm run guide:images`;
// the guide is written in the HTML only.
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const guideFolder = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'guide')
const html = readFileSync(join(guideFolder, 'index.html'), 'utf8')

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rarr: '→', larr: '←', hellip: '…', mdash: '—' }
const decode = text => text.replace(/&(#x?[0-9a-f]+|[a-z]+);/giu, (whole, name) => {
  if (name.startsWith('#x')) {
    return String.fromCodePoint(parseInt(name.slice(2), 16))
  }
  if (name.startsWith('#')) {
    return String.fromCodePoint(Number(name.slice(1)))
  }
  return ENTITIES[name] ?? whole
})

/** GitHub's anchor for a heading: lower case, punctuation dropped, spaces as hyphens. */
const slugOf = heading => decode(heading.replace(/<[^>]+>/gu, '')).trim().toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s/gu, '-')

const main = html.slice(html.indexOf('<main>') + '<main>'.length, html.indexOf('</main>'))
const anchors = new Map([...main.matchAll(/<h[23] id="([^"]+)">([\s\S]*?)<\/h[23]>/gu)].map(([, id, heading]) => [id, slugOf(heading)]))

const codeSpan = text => {
  const content = decode(text)
  return content.includes('`') ? `\`\` ${content} \`\`` : `\`${content}\``
}

/** Inline HTML as Markdown: emphasis, code, keys and links; anything else keeps its text. */
function inline(fragment) {
  const codes = []
  const kept = fragment.replace(/<code>([\s\S]*?)<\/code>/gu, (whole, content) => `\u0000${codes.push(codeSpan(content)) - 1}\u0000`)
  return decode(kept
    .replace(/<strong>([\s\S]*?)<\/strong>/gu, '**$1**')
    .replace(/<em>([\s\S]*?)<\/em>/gu, '*$1*')
    .replace(/<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gu, (whole, href, text) => `[${text}](${href.startsWith('#') ? `#${anchors.get(href.slice(1)) ?? href.slice(1)}` : href})`)
    .replace(/<(?!\/?kbd>)[^>]+>/gu, ''))
    .replace(/\s*\n\s*/gu, ' ')
    .replace(/\u0000(\d+)\u0000/gu, (whole, index) => codes[Number(index)])
    .trim()
}

const cellsOf = row => [...row.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gu)].map(([, cell]) => inline(cell).replaceAll('|', '\\|'))

/** A list; an ordered one goes on from its `start`. */
function listOf(tag, attributes, content) {
  const start = Number(/start="(\d+)"/u.exec(attributes)?.[1] ?? 1)
  return [...content.matchAll(/<li>([\s\S]*?)<\/li>/gu)].map(([, item], index) => `${tag === 'ol' ? `${start + index}.` : '-'} ${inline(item)}`).join('\n')
}

const blocks = []
const BLOCK = /<(h1|h2|h3|p|pre|figure|table|div|ul|ol|nav)(\s[^>]*)?>([\s\S]*?)<\/\1>/gu
for (const [, tag, attributes = '', content] of main.matchAll(BLOCK)) {
  switch (tag) {
    case 'h1':
    case 'h2':
    case 'h3':
      blocks.push(`${'#'.repeat(Number(tag[1]))} ${inline(content)}`)
      break
    case 'p':
      blocks.push(attributes.includes('part') ? `---\n\n**${inline(content)}**` : inline(content))
      break
    case 'pre':
      blocks.push(`\`\`\`text\n${decode(content.replace(/<[^>]+>/gu, '')).replace(/\n$/u, '')}\n\`\`\``)
      break
    case 'figure': {
      const image = /<img src="([^"]+)" alt="([^"]*)"/u.exec(content)
      const caption = /<figcaption>([\s\S]*?)<\/figcaption>/u.exec(content)
      if (image !== null) {
        blocks.push(`![${decode(image[2])}](${image[1]})`)
      }
      if (caption !== null) {
        blocks.push(`*${inline(caption[1])}*`)
      }
      break
    }
    case 'table': {
      const rows = [...content.matchAll(/<tr>([\s\S]*?)<\/tr>/gu)].map(([, row]) => cellsOf(row))
      const [head = [], ...body] = rows
      blocks.push([`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...body.map(cells => `| ${cells.join(' | ')} |`)].join('\n'))
      break
    }
    case 'div': {
      const paragraphs = [...content.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gu)].map(([, paragraph]) => `> ${inline(paragraph)}`)
      blocks.push((attributes.includes('tip') ? ['> **Tip**', '>', ...paragraphs] : paragraphs).join('\n'))
      break
    }
    case 'nav':
      blocks.push([...content.matchAll(/<(p|ol)(\s[^>]*)?>([\s\S]*?)<\/\1>/gu)].map(([, part, partAttributes = '', partContent]) => part === 'p' ? `**${inline(partContent)}**` : listOf('ol', partAttributes, partContent)).join('\n\n'))
      break
    case 'ul':
    case 'ol':
      blocks.push(listOf(tag, attributes, content))
      break
  }
}

const notice = '<!-- Made from index.html by scripts/guideMarkdown.mjs: edit the HTML, then run `npm run guide:markdown`. -->'
writeFileSync(join(guideFolder, 'guide.md'), `${notice}\n\n${blocks.join('\n\n')}\n`)
console.log(`docs/guide/guide.md written: ${blocks.length} blocks.`)
