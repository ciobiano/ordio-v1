export function ContentColumns({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={[
        'relative',
        "before:content-[''] before:absolute before:top-0 before:bottom-0",
        'before:hidden before:lg:block before:left-[calc((100%-1000px)/2)] before:w-px before:bg-white/10 before:pointer-events-none before:z-[2]',
        "after:content-[''] after:absolute after:top-0 after:bottom-0",
        'after:hidden after:lg:block after:right-[calc((100%-1000px)/2)] after:w-px after:bg-white/10 after:pointer-events-none after:z-[2]',
      ].join(' ')}
    >
      {children}
    </div>
  )
}
