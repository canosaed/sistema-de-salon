import Link from 'next/link'

export default function NoAccessPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f3ef] px-6 text-center text-[#262523]">
      <section className="max-w-md rounded-3xl border border-[#dedbd3] bg-[#fffdf9] p-8">
        <h1 className="font-serif text-3xl">Acceso no disponible</h1>
        <p className="mt-3 text-sm leading-6 text-[#77736d]">
          Tu cuenta no tiene acceso al panel de gestión. Contactá a la administración del salón.
        </p>
        <Link href="/sign-in" className="mt-6 inline-block text-sm font-semibold text-[#8c7457] underline underline-offset-4">
          Volver al inicio de sesión
        </Link>
      </section>
    </main>
  )
}
