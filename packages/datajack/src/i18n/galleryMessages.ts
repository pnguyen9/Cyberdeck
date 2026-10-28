/** The gallery of a game's illustrations. */
const en = {
  gallery: 'gallery',
  seenCount: (seen: number, total: number) => `${seen} of ${total} seen`,
  library: 'Library',
  notSeenYet: 'Not seen yet',
}

type GalleryMessages = typeof en

const fr: GalleryMessages = {
  gallery: 'galerie',
  seenCount: (seen, total) => `${seen} ${seen <= 1 ? 'vue' : 'vues'} sur ${total}`,
  library: 'Bibliothèque',
  notSeenYet: 'Pas encore vue',
}

export const galleryMessages = { en, fr }
