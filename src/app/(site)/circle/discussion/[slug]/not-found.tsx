import Link from 'next/link'

export default function CircleDiscussionNotFound() {
  return <main className="circle-page"><div className="circle-notice"><p>DISCUSSION UNAVAILABLE</p><h2>This conversation is no longer available.</h2><span>It may have moved or been removed from public view.</span><Link className="button button-secondary" href="/circle">Return to Evo Circle</Link></div></main>
}
