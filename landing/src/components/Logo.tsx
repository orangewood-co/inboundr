export default function Logo({ className = "max-w-24 object-contain" }: { className?: string }) {
  return <img src="/logo.png" alt="BTSA" className={className} />
}
