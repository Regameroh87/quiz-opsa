export default function Logo({ height = 36 }: { height?: number }) {
  return <img src="/logo-new-holland.png" alt="New Holland Agriculture" height={height} style={{ height, width: 'auto' }} />
}
