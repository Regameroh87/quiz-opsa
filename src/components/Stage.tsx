/** Escenario de pantalla completa: campo azul con las cuatro mascotas pegadas en las esquinas y la pieza principal al centro. */
// Las mascotas son stickers pegados en las esquinas del campo; decorativas (aria-hidden).
// En el celular quedan solo las dos de arriba, más chicas.
const MASCOTS = [
  { src: '/mascotas/tractor.webp', w: 720, h: 393, className: 'left-[5%] top-[10%] w-[300px] max-md:left-[-4%] max-md:top-[3%] max-md:w-[150px]', tilt: '-8deg', delay: 100 },
  { src: '/mascotas/cosechadora.webp', w: 720, h: 393, className: 'right-[6%] top-[8%] w-[260px] max-md:right-[-4%] max-md:top-[2%] max-md:w-[150px]', tilt: '7deg', delay: 220 },
  { src: '/mascotas/pulverizadora.webp', w: 720, h: 720, className: 'left-[8%] bottom-[8%] w-[250px] max-md:hidden', tilt: '5deg', delay: 340 },
  { src: '/mascotas/tt4.webp', w: 720, h: 720, className: 'right-[5%] bottom-[9%] w-[280px] max-md:hidden', tilt: '-6deg', delay: 460 },
] as const

export default function Stage({ children }: { children: React.ReactNode }) {
  return (
    <main className="field relative grid place-items-center overflow-hidden px-4 pb-14 pt-[max(2.5rem,env(safe-area-inset-top))] max-md:pt-32">
      {MASCOTS.map((m) => (
        <div key={m.src} aria-hidden className={`sticker-tile stick-in ${m.className}`} style={{ '--tilt': m.tilt, '--delay': `${m.delay}ms` } as React.CSSProperties}>
          {/* eslint-disable-next-line @next/next/no-img-element -- decorativa, ancho fluido por CSS */}
          <img src={m.src} width={m.w} height={m.h} alt="" draggable={false} />
        </div>
      ))}
      {children}
    </main>
  )
}
