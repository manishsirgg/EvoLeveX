export type VaultKind = 'book' | 'course'
export type ProductMode = 'digital' | 'physical' | 'hybrid'

export type VaultActionState = { error?: string; fields?: Record<string, string> }
export const initialVaultState: VaultActionState = {}

export const slugifyVault = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export type VaultCategoryActionState = { error?: string; fields?: Record<string, string>; isActive?: boolean }
export const initialVaultCategoryState: VaultCategoryActionState = {}
