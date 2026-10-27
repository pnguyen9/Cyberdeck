import type { PageLayout } from '../src/index'

/** Every character is 1 unit wide and a line holds 40 of them: splits can be checked by counting characters. */
export const monospaceLayout: PageLayout = {
  lineWidth: 40,
  maxLines: 2,
  measureText: text => [...text].length,
}
