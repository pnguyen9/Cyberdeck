const en = {
  shownAsText: (fileName: string) => `${fileName} is shown as text: check it, then import it.`,
  scenesPart: (names: string) => ` Scenes: ${names}.`,
  importedScenes: (names: readonly string[]) => `Imported ${names.length === 1 ? 'the scene' : 'the scenes'} ${names.join(', ')}.`,
  importedChapters: (titles: readonly string[]) => `Imported ${titles.length === 1 ? `1 chapter: ${titles[0]}` : `${titles.length} chapters: ${titles.join(', ')}`}.`,
  importedPages: (pageCount: number, chapterTitle: string | null) => `Imported ${pageCount} pages at the end of ${chapterTitle ?? 'the chapter'}.`,
  replacedChapter: (chapterTitle: string | null, pageCount: number) => `${chapterTitle ?? 'the chapter'} was replaced by the text imported: ${pageCount} pages.`,
  openDocument: 'Open a document…',
  useSample: 'Use the sample story',
  textToImport: 'Text to import',
  placeholder: 'Paste the text of a chapter or of the whole story. A paragraph is narration; “Name:” or a dash starts dialogue; [directives] set the stage.',
  importAs: 'Import as',
  newChapters: 'New chapters',
  endOfChapter: 'Pages at the end of a chapter',
  replaceChapter: 'In place of a chapter',
  chapter: 'Chapter',
  newChaptersSummary: (titles: readonly string[], pageCount: number) =>
    `${titles.length === 0 ? '' : `${titles.length} ${titles.length === 1 ? 'chapter' : 'chapters'} (${titles.join(', ')}), `}${pageCount} pages.`,
  replaceSummary: (pageCount: number) => `${pageCount} pages, in place of the chapter chosen.`,
  endOfChapterSummary: (pageCount: number, dropsHeadings: boolean) => `${pageCount} pages${dropsHeadings ? '; chapter headings are dropped' : ''}.`,
  scenesSummary: (names: readonly string[]) => `${names.length === 1 ? 'Scene' : 'Scenes'}: ${names.join(', ')}. A scene named like one of the project replaces it.`,
  line: (line: number) => `Line ${line}`,
  import: 'Import',
  errorsToFix: (count: number) => `${count} ${count === 1 ? 'error' : 'errors'} to fix first.`,
  startWithoutText: 'Start without a text',
  startWithoutTextTitle: 'An empty chapter, to write page by page in the storyboard',
}

type ImportMessages = typeof en

const pages = (count: number) => `${count} ${count <= 1 ? 'page' : 'pages'}`

const fr: ImportMessages = {
  shownAsText: fileName => `Le contenu de ${fileName} est affiché sous forme de texte : relisez-le, puis importez-le.`,
  scenesPart: names => ` Scènes : ${names}.`,
  importedScenes: names => `${names.length <= 1 ? 'Scène importée' : 'Scènes importées'} : ${names.join(', ')}.`,
  importedChapters: titles => `${titles.length <= 1 ? '1 chapitre importé' : `${titles.length} chapitres importés`} : ${titles.join(', ')}.`,
  importedPages: (pageCount, chapterTitle) => `${pageCount} ${pageCount <= 1 ? 'page importée' : 'pages importées'} à la fin ${chapterTitle === null ? 'du chapitre' : `de ${chapterTitle}`}.`,
  replacedChapter: (chapterTitle, pageCount) => `Le texte importé remplace ${chapterTitle ?? 'le chapitre'} : ${pages(pageCount)}.`,
  openDocument: 'Ouvrir un document…',
  useSample: 'Utiliser l’histoire d’exemple',
  textToImport: 'Texte à importer',
  placeholder: 'Collez ici le texte d’un chapitre ou de toute l’histoire. Chaque paragraphe est de la narration ; un tiret suivi d’un nom, « — Marie : », ouvre une réplique ; les [directives] règlent la mise en scène.',
  importAs: 'Importer en tant que',
  newChapters: 'Nouveaux chapitres',
  endOfChapter: 'Pages à la fin d’un chapitre',
  replaceChapter: 'À la place d’un chapitre',
  chapter: 'Chapitre',
  newChaptersSummary: (titles, pageCount) =>
    `${titles.length === 0 ? '' : `${titles.length} ${titles.length <= 1 ? 'chapitre' : 'chapitres'} (${titles.join(', ')}), `}${pages(pageCount)}.`,
  replaceSummary: pageCount => `${pages(pageCount)}, à la place du chapitre choisi.`,
  endOfChapterSummary: (pageCount, dropsHeadings) => `${pages(pageCount)}${dropsHeadings ? ' ; les titres de chapitre sont ignorés' : ''}.`,
  scenesSummary: names => `${names.length <= 1 ? 'Scène' : 'Scènes'} : ${names.join(', ')}. Une scène qui porte le nom d’une scène du projet la remplace.`,
  line: line => `Ligne ${line}`,
  import: 'Importer',
  errorsToFix: count => `${count} ${count <= 1 ? 'erreur' : 'erreurs'} à corriger d’abord.`,
  startWithoutText: 'Commencer sans texte',
  startWithoutTextTitle: 'Un chapitre vide, à écrire page par page dans le storyboard',
}

export const importMessages = { en, fr }
