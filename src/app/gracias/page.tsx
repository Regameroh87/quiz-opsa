import type { Metadata } from 'next'
import Stage from '@/components/Stage'
import Logo from '@/components/Logo'
import Avatar, { AVATARS } from '@/components/Avatar'

export const metadata: Metadata = { title: '¡Gracias por jugar! · Quiz New Holland' }

// Destino de /play cuando el anfitrión cierra el evento desde el podio (close_game).
// ?avatar= trae el personaje del jugador para despedirlo con su sticker.
export default async function Gracias({ searchParams }: { searchParams: Promise<{ avatar?: string }> }) {
  const { avatar } = await searchParams
  const known = AVATARS.some((a) => a.id === avatar)
  return (
    <Stage>
      <section className="sticker-card stick-in flex flex-col items-center gap-3">
        {known && <Avatar id={avatar} className="-mt-24 mb-1 size-28 border-[6px] shadow-[0_8px_0_rgb(0_20_60/0.4)]" />}
        <Logo height={34} />
        <h1 className="sticker-title">¡Gracias por jugar!</h1>
        <p className="font-bold text-ink-soft">Esperamos que la hayas pasado bien. ¡Nos vemos en el próximo evento!</p>
      </section>
    </Stage>
  )
}
