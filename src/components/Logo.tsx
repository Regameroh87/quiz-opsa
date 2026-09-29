import Image from 'next/image'

// Proporción del PNG original (199×49).
export default function Logo({ height = 36 }: { height?: number }) {
  return <Image src="/logo-new-holland.png" alt="New Holland Agriculture" height={height} width={Math.round((height * 199) / 49)} priority />
}
