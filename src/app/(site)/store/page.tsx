import type { Metadata } from 'next'
import { EcosystemPage } from '@/components/site/ecosystem-page'

export const metadata: Metadata = { title: 'Evo Store', description: 'Purposeful EvoLeveX merchandise and products.' }
export default function Page() { return <EcosystemPage eyebrow="Objects / Intention" title="Evo Store" description="Purposeful products and EvoLeveX essentials selected for men who value standards in every detail." note="The Evo Store collection is being prepared." /> }
