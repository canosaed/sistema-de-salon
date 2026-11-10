"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { authClient } from "@/lib/auth-client"

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter()
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)
  const [registrationToken, setRegistrationToken] = useState("")
  const isSignUp = mode === "sign-up"

  useEffect(() => {
    if (!isSignUp) return
    const token = new URLSearchParams(window.location.hash.slice(1)).get("invitation_token")
      || new URLSearchParams(window.location.search).get("invitation_token")
      || ""
    if (token) {
      setRegistrationToken(token)
      window.history.replaceState(null, "", window.location.pathname)
    }
  }, [isSignUp])

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError("")
    const form = new FormData(event.currentTarget)
    const email = String(form.get("email"))
    const password = String(form.get("password"))
    const name = String(form.get("name") || "Lucía")
    try {
      if (isSignUp && !registrationToken.trim()) {
        setError("Ingresá el token de invitación o el token de configuración inicial.")
        return
      }
      const result = isSignUp
        ? await authClient.signUp.email(
            { email, password, name },
            { headers: { "x-salon-registration-token": registrationToken.trim() } }
          )
        : await authClient.signIn.email({ email, password })
      if (result.error) setError("No pudimos completar el acceso. Revisa tus datos e inténtalo de nuevo.")
      else { router.push("/"); router.refresh() }
    } catch {
      setError("No pudimos completar el acceso. Revisa tus datos e inténtalo de nuevo.")
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f3ef] px-6 py-12 text-[#262523]">
      <div className="w-full max-w-md rounded-[28px] border border-[#dedbd3] bg-[#fffdf9] p-8 shadow-[0_24px_70px_rgba(42,38,31,0.10)]">
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#927c60]">Atelier Gestión</p>
        <h1 className="mt-5 font-serif text-4xl tracking-[-0.04em]">{isSignUp ? "Alta de equipo" : "Bienvenida de nuevo"}</h1>
        <p className="mt-3 text-sm leading-6 text-[#77736d]">{isSignUp ? "Las cuentas se crean únicamente con un token de configuración o una invitación del salón." : "Accede a la agenda y los detalles de tu salón."}</p>
        <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4">
          {isSignUp && <label className="grid gap-2 text-xs font-semibold">Nombre<input name="name" required className="h-12 rounded-xl border border-[#d8d4cc] bg-white px-4 text-sm outline-none focus:border-[#937b5d]" placeholder="Lucía Martínez" /></label>}
          {isSignUp && <label className="grid gap-2 text-xs font-semibold">Token de invitación<input name="registrationToken" value={registrationToken} onChange={(event) => setRegistrationToken(event.target.value)} required minLength={32} autoComplete="off" className="h-12 rounded-xl border border-[#d8d4cc] bg-white px-4 text-sm outline-none focus:border-[#937b5d]" placeholder="Token de un solo uso" /></label>}
          <label className="grid gap-2 text-xs font-semibold">Email<input name="email" type="email" required className="h-12 rounded-xl border border-[#d8d4cc] bg-white px-4 text-sm outline-none focus:border-[#937b5d]" placeholder="hola@atelier.com" /></label>
          <label className="grid gap-2 text-xs font-semibold">Contraseña<input name="password" type="password" minLength={8} required className="h-12 rounded-xl border border-[#d8d4cc] bg-white px-4 text-sm outline-none focus:border-[#937b5d]" placeholder="Mínimo 8 caracteres" /></label>
          {error && <p role="alert" className="text-sm text-[#b45b4d]">{error}</p>}
          <button disabled={pending} className="mt-2 h-12 rounded-xl bg-[#262523] text-sm font-semibold text-[#fffdf9] transition hover:bg-[#3d3a35] disabled:opacity-60">{pending ? "Cargando…" : isSignUp ? "Crear cuenta" : "Entrar al panel"}</button>
        </form>
        <p className="mt-6 text-center text-sm text-[#77736d]">{isSignUp ? "¿Ya tienes cuenta?" : "¿Primera vez aquí?"}{" "}<Link className="font-semibold text-[#8c7457] underline underline-offset-4" href={isSignUp ? "/sign-in" : "/sign-up"}>{isSignUp ? "Inicia sesión" : "Crea tu cuenta"}</Link></p>
      </div>
    </main>
  )
}
