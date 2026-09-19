export type EditorActionState = { error: string | null; fields?: Record<string, string> }
export const initialEditorState: EditorActionState = { error: null }

export function slugify(value: string) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120)
}
