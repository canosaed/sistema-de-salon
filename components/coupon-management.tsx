'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Copy, Plus, ToggleLeft, ToggleRight } from 'lucide-react'
import { createCouponAction, setCouponActiveAction, type CouponInput } from '@/app/actions/coupons'
import { getSalonDateString } from '@/lib/salon-time'

type CouponSummary = {
  id: string
  code: string
  description: string
  discountType: string
  discountValue: number
  minimumPurchase: number
  startDate: string
  endDate: string
  maxUses: number | null
  isActive: boolean
  uses: number
}

type CouponDraft = {
  code: string
  description: string
  discountType: 'percentage' | 'fixed'
  discountValue: string
  minimumPurchase: string
  startDate: string
  endDate: string
  maxUses: string
}

function createEmptyDraft(): CouponDraft {
  return {
    code: '',
    description: '',
    discountType: 'percentage',
    discountValue: '',
    minimumPurchase: '0',
    startDate: getSalonDateString(),
    endDate: '',
    maxUses: '',
  }
}

function generateCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  return Array.from(bytes, (byte) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[byte % 32]).join('')
}

function discountLabel(coupon: CouponSummary) {
  return coupon.discountType === 'percentage'
    ? `${coupon.discountValue}%`
    : `$${coupon.discountValue.toLocaleString('es-AR')} ARS`
}

export default function CouponManagement({ initialCoupons }: { initialCoupons: CouponSummary[] }) {
  const router = useRouter()
  const [draft, setDraft] = useState<CouponDraft>(createEmptyDraft)
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  async function submitCoupon(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setMessage('')
    try {
      const input: CouponInput = {
        code: draft.code,
        description: draft.description,
        discountType: draft.discountType,
        discountValue: Number(draft.discountValue),
        minimumPurchase: Number(draft.minimumPurchase),
        startDate: draft.startDate,
        endDate: draft.endDate,
        maxUses: draft.maxUses ? Number(draft.maxUses) : null,
      }
      await createCouponAction(input)
      setDraft(createEmptyDraft())
      setMessage('Promoción creada. Ya puede usarse en las reservas públicas durante su vigencia.')
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo crear la promoción.')
    } finally {
      setPending(false)
    }
  }

  async function toggleCoupon(coupon: CouponSummary) {
    setPending(true)
    setMessage('')
    try {
      await setCouponActiveAction(coupon.id, !coupon.isActive)
      setMessage(`La promoción ${coupon.code} quedó ${coupon.isActive ? 'desactivada' : 'activada'}.`)
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo actualizar la promoción.')
    } finally {
      setPending(false)
    }
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedCode(code)
      setMessage(`Código ${code} copiado.`)
      window.setTimeout(() => setCopiedCode(null), 2000)
    } catch {
      setMessage('No se pudo copiar el código. Seleccionalo y copialo manualmente.')
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f3ef] px-4 py-8 text-[#262523] sm:px-6 sm:py-12">
      <div className="mx-auto grid max-w-6xl gap-6">
        <header className="rounded-[28px] border border-[#dedbd3] bg-[#fffdf9] p-6 shadow-[0_24px_70px_rgba(42,38,31,0.06)] sm:p-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#927c60]">Atelier Gestión</p>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-serif text-3xl tracking-[-0.04em] sm:text-4xl">Cupones y promociones</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[#77736d]">
                Creá códigos de descuento para las reservas online del salón.
              </p>
            </div>
            <a href="/" className="rounded-xl border border-[#d8d4cc] px-5 py-3 text-sm font-semibold text-[#514b43] transition hover:bg-[#f5f3ef]">
              Volver al panel
            </a>
          </div>
        </header>

        {message && (
          <p role="status" className="rounded-xl border border-[#dedbd3] bg-[#fffdf9] px-4 py-3 text-sm leading-6 text-[#5f5a52]">
            {message}
          </p>
        )}

        <section className="rounded-[28px] border border-[#dedbd3] bg-[#fffdf9] p-6 shadow-[0_24px_70px_rgba(42,38,31,0.06)] sm:p-8" aria-labelledby="create-coupon-title">
          <h2 id="create-coupon-title" className="font-serif text-2xl tracking-[-0.03em]">Crear una promoción</h2>
          <p className="mt-2 text-sm leading-6 text-[#77736d]">
            Definí el beneficio, la vigencia y cuántas veces se puede utilizar.
          </p>
          <form onSubmit={submitCoupon} className="mt-6 grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <label htmlFor="coupon-code" className="text-xs font-semibold">Código</label>
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <input
                    id="coupon-code"
                    required
                    minLength={3}
                    maxLength={30}
                    pattern="[A-Za-z0-9Ññ_-]+"
                    value={draft.code}
                    onChange={(event) => setDraft({ ...draft, code: event.target.value.toUpperCase() })}
                    placeholder="Ej. BIENVENIDA20"
                    className="h-12 min-w-0 rounded-xl border border-[#d8d4cc] bg-white px-4 text-sm outline-none focus:border-[#937b5d]"
                  />
                  <button
                    type="button"
                    className="h-12 rounded-xl border border-[#d8d4cc] px-5 text-sm font-semibold transition hover:bg-[#f5f3ef]"
                    onClick={() => setDraft({ ...draft, code: generateCode() })}
                  >
                    Generar
                  </button>
                </div>
              </div>
              <div className="grid gap-2">
                <label htmlFor="coupon-description" className="text-xs font-semibold">Descripción</label>
                <input
                  id="coupon-description"
                  required
                  maxLength={160}
                  value={draft.description}
                  onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                  placeholder="Ej. Descuento de bienvenida"
                  className="h-12 rounded-xl border border-[#d8d4cc] bg-white px-4 text-sm outline-none focus:border-[#937b5d]"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-2">
                <label htmlFor="coupon-type" className="text-xs font-semibold">Tipo de descuento</label>
                <select
                  id="coupon-type"
                  value={draft.discountType}
                  onChange={(event) => setDraft({ ...draft, discountType: event.target.value as CouponDraft['discountType'] })}
                  className="h-12 rounded-xl border border-[#d8d4cc] bg-white px-4 text-sm outline-none focus:border-[#937b5d]"
                >
                  <option value="percentage">Porcentaje</option>
                  <option value="fixed">Monto fijo (ARS)</option>
                </select>
              </div>
              <div className="grid gap-2">
                <label htmlFor="coupon-value" className="text-xs font-semibold">Descuento</label>
                <input
                  id="coupon-value"
                  required
                  type="number"
                  min="0.01"
                  max={draft.discountType === 'percentage' ? 100 : undefined}
                  step="0.01"
                  value={draft.discountValue}
                  onChange={(event) => setDraft({ ...draft, discountValue: event.target.value })}
                  className="h-12 rounded-xl border border-[#d8d4cc] bg-white px-4 text-sm outline-none focus:border-[#937b5d]"
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="coupon-minimum" className="text-xs font-semibold">Compra mínima (ARS)</label>
                <input
                  id="coupon-minimum"
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.minimumPurchase}
                  onChange={(event) => setDraft({ ...draft, minimumPurchase: event.target.value })}
                  className="h-12 rounded-xl border border-[#d8d4cc] bg-white px-4 text-sm outline-none focus:border-[#937b5d]"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-2">
                <label htmlFor="coupon-start" className="text-xs font-semibold">Válido desde</label>
                <input
                  id="coupon-start"
                  required
                  type="date"
                  value={draft.startDate}
                  onChange={(event) => setDraft({ ...draft, startDate: event.target.value })}
                  className="h-12 rounded-xl border border-[#d8d4cc] bg-white px-4 text-sm outline-none focus:border-[#937b5d]"
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="coupon-end" className="text-xs font-semibold">Válido hasta</label>
                <input
                  id="coupon-end"
                  required
                  type="date"
                  min={draft.startDate}
                  value={draft.endDate}
                  onChange={(event) => setDraft({ ...draft, endDate: event.target.value })}
                  className="h-12 rounded-xl border border-[#d8d4cc] bg-white px-4 text-sm outline-none focus:border-[#937b5d]"
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="coupon-max-uses" className="text-xs font-semibold">Máximo de usos (opcional)</label>
                <input
                  id="coupon-max-uses"
                  type="number"
                  min="1"
                  step="1"
                  value={draft.maxUses}
                  onChange={(event) => setDraft({ ...draft, maxUses: event.target.value })}
                  placeholder="Sin límite"
                  className="h-12 rounded-xl border border-[#d8d4cc] bg-white px-4 text-sm outline-none focus:border-[#937b5d]"
                />
              </div>
            </div>

            <button type="submit" className="h-12 justify-self-start rounded-xl bg-[#262523] px-6 text-sm font-semibold text-[#fffdf9] transition hover:bg-[#3d3a35] disabled:opacity-60" disabled={pending}>
              <Plus size={16} /> {pending ? 'Guardando...' : 'Crear promoción'}
            </button>
          </form>
        </section>

        <section className="rounded-[28px] border border-[#dedbd3] bg-[#fffdf9] p-6 shadow-[0_24px_70px_rgba(42,38,31,0.06)] sm:p-8" aria-labelledby="coupon-list-title">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="coupon-list-title" className="font-serif text-2xl tracking-[-0.03em]">Promociones creadas</h2>
              <p className="mt-2 text-sm text-[#77736d]">{initialCoupons.length} promociones</p>
            </div>
          </div>
          <div className="mt-6 grid gap-4">
            {initialCoupons.map((coupon) => (
              <article key={coupon.id} className="grid gap-4 rounded-2xl border border-[#e5e1d9] bg-white p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-all font-mono text-sm font-semibold tracking-wide">{coupon.code}</p>
                    <p className="mt-1 text-sm leading-6 text-[#77736d]">{coupon.description}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${coupon.isActive ? 'bg-[#e8f1e8] text-[#426947]' : 'bg-[#f5f3ef] text-[#77736d]'}`}>
                    {coupon.isActive ? 'Activa' : 'Pausada'}
                  </span>
                </div>
                <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <p className="text-xs font-semibold text-[#77736d]">Descuento</p>
                    <p className="mt-1 font-semibold">{discountLabel(coupon)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#77736d]">Vigencia</p>
                    <p className="mt-1">{coupon.startDate} – {coupon.endDate}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#77736d]">Usos</p>
                    <p className="mt-1">{coupon.uses}{coupon.maxUses === null ? '' : ` / ${coupon.maxUses}`}</p>
                  </div>
                  {coupon.minimumPurchase > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-[#77736d]">Compra mínima</p>
                      <p className="mt-1">${coupon.minimumPurchase.toLocaleString('es-AR')} ARS</p>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 border-t border-[#eeeae3] pt-4">
                  <button
                    type="button"
                    className="rounded-xl border border-[#d8d4cc] px-4 py-2.5 text-sm font-semibold transition hover:bg-[#f5f3ef]"
                    onClick={() => copyCode(coupon.code)}
                    aria-label={`Copiar ${coupon.code}`}
                  >
                    {copiedCode === coupon.code ? <Check size={16} /> : <Copy size={16} />}
                    {copiedCode === coupon.code ? 'Copiado' : 'Copiar código'}
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border border-[#d8d4cc] px-4 py-2.5 text-sm font-semibold transition hover:bg-[#f5f3ef] disabled:opacity-50"
                    onClick={() => toggleCoupon(coupon)}
                    disabled={pending}
                    aria-label={`${coupon.isActive ? 'Desactivar' : 'Activar'} ${coupon.code}`}
                  >
                    {coupon.isActive ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                    {coupon.isActive ? 'Pausar' : 'Activar'}
                  </button>
                </div>
              </article>
            ))}
            {!initialCoupons.length && (
              <p className="rounded-2xl border border-dashed border-[#d8d4cc] px-5 py-10 text-center text-sm text-[#77736d]">
                Todavía no hay promociones. Creá la primera arriba.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
