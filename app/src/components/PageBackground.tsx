/** Full-viewport background photo for a single page, sitting behind that
 * page's content but above the app-wide background set on <body>. */
export function PageBackground({ src }: { src: string }) {
  return (
    <div
      className="fixed inset-0 -z-10 bg-cover bg-center"
      style={{
        backgroundImage: `linear-gradient(to bottom, rgba(4, 14, 8, 0.55) 0%, rgba(4, 14, 8, 0.25) 30%, rgba(4, 14, 8, 0.2) 55%, rgba(4, 14, 8, 0.55) 100%), url(${src})`,
      }}
    />
  )
}
