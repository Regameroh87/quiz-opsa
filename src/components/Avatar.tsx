// Personajes que puede elegir un jugador. La lista válida también está en la base
// (supabase/migrations/0006_player_avatar.sql): si se agrega uno, van los dos.
export const AVATARS = [
  { id: 'tractor', name: 'Tractor', src: '/mascotas/tractor.webp' },
  { id: 'cosechadora', name: 'Cosechadora', src: '/mascotas/cosechadora.webp' },
  { id: 'pulverizadora', name: 'Pulverizadora', src: '/mascotas/pulverizadora.webp' },
  { id: 'tt4', name: 'TT4', src: '/mascotas/tt4.webp' },
] as const

export type AvatarId = (typeof AVATARS)[number]['id']

/** Personaje como sticker redondo. Decorativo: el nombre del jugador siempre va al lado. */
export default function Avatar({ id, className = '' }: { id: string | null | undefined; className?: string }) {
  const a = AVATARS.find((x) => x.id === id) ?? AVATARS[0]
  return (
    // eslint-disable-next-line @next/next/no-img-element -- ya optimizada; se muestra en tamaños chicos y fluidos
    <img src={a.src} alt="" aria-hidden draggable={false}
      className={`aspect-square flex-none rounded-full border-white bg-white object-cover ${className}`} />
  )
}
