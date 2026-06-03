export default function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: 'h-8',
    md: 'h-12',
    lg: 'h-20',
  }
  return (
    <img
      src="/favicon.png"
      alt="Beer Game"
      className={`${sizes[size]} w-auto`}
    />
  )
}
