import type { Metadata } from 'next'
import { EcosystemPage } from '@/components/site/ecosystem-page'

export const metadata: Metadata = { title: 'Evo Daily', description: 'Daily intelligence, strategy and practical insights for men committed to progress.' }
export default function Page() { return <EcosystemPage eyebrow="Intelligence / Every day" title="Evo Daily" description="Clear thinking for the work of becoming more. Discover practical insights across performance, relationships, wealth and life strategy." note="Original editorial intelligence is coming to Evo Daily." /> }
