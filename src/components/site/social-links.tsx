import { socialLinks } from '@/lib/social-links'

type SocialLinksProps = {
  className?: string
  labelledBy?: string
}

export function SocialLinks({ className = '', labelledBy }: SocialLinksProps) {
  return (
    <div className={`social-links ${className}`.trim()} aria-labelledby={labelledBy}>
      {socialLinks.map((social) => (
        <a
          key={social.name}
          href={social.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`EvoLeveX on ${social.name} (opens in a new tab)`}
          title={social.name}
        >
          <span aria-hidden="true">{social.mark}</span>
        </a>
      ))}
    </div>
  )
}
