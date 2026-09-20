export const socialLinks = [
  { name: 'YouTube', href: 'https://youtube.com/@evolevex', icon: 'youtube' },
  { name: 'Instagram', href: 'https://instagram.com/manishsirgg', icon: 'instagram' },
  { name: 'X', href: 'https://x.com/manishsirg', icon: 'x' },
  { name: 'Facebook', href: 'https://facebook.com/evolevex', icon: 'facebook' },
  { name: 'LinkedIn', href: 'https://www.linkedin.com/company/evolevex', icon: 'linkedin' },
  { name: 'Tumblr', href: 'https://manishsirg.tumblr.com', icon: 'tumblr' },
  { name: 'Rumble', href: 'https://rumble.com/c/EvoLeveX', icon: 'rumble' },
] as const

export type SocialIconName = (typeof socialLinks)[number]['icon']
