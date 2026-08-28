export default function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-flex items-center justify-center rounded-lg bg-brand/15 ring-1 ring-brand/30 p-1.5">
      <img src="/favicon.svg" alt="CrossPresenter logo" width={size} height={size} className="block" />
    </span>
  )
}
