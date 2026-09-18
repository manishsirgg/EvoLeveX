import type { Metadata } from 'next'
import { EcosystemPage } from '@/components/site/ecosystem-page'

export const metadata: Metadata = { title: 'Evo TV', description: 'Video-driven ideas, analysis and transformation from EvoLeveX.' }
export default function Page() { return <EcosystemPage eyebrow="Watch / Learn / Apply" title="Evo TV" description="Ideas with depth, delivered with clarity. Evo TV brings analysis, conversations and visual stories into focus." note="The first Evo TV releases are in development." /> }
