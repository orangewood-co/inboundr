/**
 * Brand panel for the auth screens. Plays a looping product video behind a
 * subtle gradient scrim so the marketing copy stays legible over the footage.
 */
const HERO_VIDEO_URL =
  "https://inboundr-public.s3.ap-south-1.amazonaws.com/warehouse.mp4"

export function AuthHero() {
  return (
    <div className="relative hidden overflow-hidden border-l bg-muted lg:block">
      <video
        className="absolute inset-0 h-full w-full object-cover"
        src={HERO_VIDEO_URL}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/10" />
      <div className="relative flex h-full flex-col justify-end p-10">
        <div className="max-w-md space-y-3">
          <p className="text-2xl font-semibold tracking-tight text-white">
            Every RFQ, quote, and invoice in one place.
          </p>
          <p className="text-sm leading-relaxed text-white/80">
            Inboundr turns inbound emails into a sales pipeline your whole team
            can run — from first request to paid invoice.
          </p>
        </div>
      </div>
    </div>
  )
}
