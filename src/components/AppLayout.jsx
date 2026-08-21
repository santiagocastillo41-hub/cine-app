import NavBar from './NavBar'

// Mobile-first: en pantallas grandes el contenido queda centrado a
// 420px, como el frame de teléfono de docs/, sin ser una app nativa.
export default function AppLayout({ children }) {
  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto flex min-h-screen w-full max-w-[420px] flex-col pb-[76px]">
        {children}
      </div>
      <div className="fixed inset-x-0 bottom-0 flex justify-center bg-bg">
        <div className="w-full max-w-[420px]">
          <NavBar />
        </div>
      </div>
    </div>
  )
}
