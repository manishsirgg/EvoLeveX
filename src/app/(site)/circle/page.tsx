import type { Metadata } from 'next'
import { EcosystemPage } from '@/components/site/ecosystem-page'

export const metadata: Metadata = { title: 'Evo Circle', description: 'The EvoLeveX community for focused discussion and shared progress.' }
export default function Page() { return <EcosystemPage eyebrow="Community / Standards" title="Evo Circle" description="A space for ambitious men to exchange perspective, sharpen ideas and hold themselves to a higher standard." note="The Evo Circle community experience is taking shape." /> }
