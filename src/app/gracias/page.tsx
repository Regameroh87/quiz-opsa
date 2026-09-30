import type { Metadata } from 'next'
import Stage from '@/components/Stage'
import Logo from '@/components/Logo'
import PageTransition from '@/components/PageTransition'
import Avatar, { AVATARS } from '@/components/Avatar'

export const metadata: Metadata = { title: '¡Gracias por jugar! · Quiz New Holland' }

// Destino de /play cuando el anfitrión cierra el evento desde el podio (close_game).
// ?avatar= trae el personaje del jugador para despedirlo con su sticker.
export default async function Gracias({ searchParams }: { searchParams: Promise<{ avatar?: string }> }) {
  const { avatar } = await searchParams
  const known = AVATARS.some((a) => a.id === avatar)
  return (
    <PageTransition>
    <Stage>
      <section className="sticker-card stick-in flex flex-col items-center gap-3">
        {known && <Avatar id={avatar} className="-mt-24 mb-1 size-28 border-[6px] shadow-[0_8px_0_rgb(0_20_60/0.4)]" />}
        <Logo height={34} />
        <h1 className="sticker-title">¡Gracias por jugar!</h1>
        <p className="font-bold text-ink-soft">Esperamos que la hayas pasado bien. ¡Nos vemos en el próximo evento!</p>
      </section>
      {/* Pie discreto: el sitio del concesionario, sin competir con la despedida. */}
      <footer className="absolute inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[3] text-center">
        <a className="text-sm font-semibold text-ink-soft/80 underline-offset-4 hover:text-white hover:underline"
          href="https://www.oscarpourtau.com" target="_blank" rel="noopener">
          www.oscarpourtau.com
        </a>
      </footer>
    </Stage>
    </PageTransition>
  )
}
