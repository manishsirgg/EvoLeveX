import type { Metadata } from 'next'
import { EcosystemPage } from '@/components/site/ecosystem-page'

export const metadata: Metadata = { title: 'Evo Vault', description: 'Books, guides and courses for deeper personal development.' }
export default function Page() { return <EcosystemPage eyebrow="Knowledge / Depth" title="Evo Vault" description="Go beyond the surface with structured books, guides and courses designed for lasting application." note="The foundational Evo Vault collection is being curated." /> }
