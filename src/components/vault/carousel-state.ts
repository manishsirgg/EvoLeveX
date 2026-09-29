export type CarouselNavigation = 'previous' | 'next' | 'first' | 'last'

export function getCarouselIndex(current: number, length: number, navigation: CarouselNavigation) {
  if (length <= 1) return 0
  if (navigation === 'first') return 0
  if (navigation === 'last') return length - 1
  if (navigation === 'previous') return (current - 1 + length) % length
  return (current + 1) % length
}
