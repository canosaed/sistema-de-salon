'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Plus, Trash2, X } from 'lucide-react'
import {
  createCategoryAction,
  deleteCategoryAction,
  updateCategoryAction,
} from '@/app/actions/categories'
import {
  createSpecialtyAction,
  deleteSpecialtyAction,
  updateSpecialtyAction,
} from '@/app/actions/specialties'

interface Category {
  id: string
  name: string
  description: string | null
  order: number
}

interface Specialty {
  id: string
  name: string
}

export function CatalogManagement({
  initialCategories,
  initialSpecialties,
}: {
  initialCategories: Category[]
  initialSpecialties: Specialty[]
}) {
  const router = useRouter()
  const [categoryForm, setCategoryForm] = useState({ id: '', name: '', description: '', order: 0 })
  const [specialtyId, setSpecialtyId] = useState('')
  const [specialtyName, setSpecialtyName] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  function showError(reason: unknown) {
    setError(reason instanceof Error ? reason.message : 'No se pudo completar el cambio.')
  }

  async function saveCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError('')
    try {
      if (categoryForm.id) {
        await updateCategoryAction(categoryForm.id, categoryForm)
      } else {
        await createCategoryAction(categoryForm)
      }
      setCategoryForm({ id: '', name: '', description: '', order: 0 })
      router.refresh()
    } catch (reason) {
      showError(reason)
    } finally {
      setPending(false)
    }
  }

  async function removeCategory(category: Category) {
    if (!window.confirm(`¿Eliminar la categoría "${category.name}"?`)) return
    setPending(true)
    setError('')
    try {
      await deleteCategoryAction(category.id)
      router.refresh()
    } catch (reason) {
      showError(reason)
    } finally {
      setPending(false)
    }
  }

  async function saveSpecialty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError('')
    try {
      if (specialtyId) {
        await updateSpecialtyAction(specialtyId, specialtyName)
      } else {
        await createSpecialtyAction(specialtyName)
      }
      setSpecialtyId('')
      setSpecialtyName('')
      router.refresh()
    } catch (reason) {
      showError(reason)
    } finally {
      setPending(false)
    }
  }

  async function removeSpecialty(specialty: Specialty) {
    if (!window.confirm(`¿Eliminar la especialidad "${specialty.name}"?`)) return
    setPending(true)
    setError('')
    try {
      await deleteSpecialtyAction(specialty.id)
      router.refresh()
    } catch (reason) {
      showError(reason)
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="settings-section catalog-management" aria-labelledby="catalog-management-title">
      <div className="settings-section-header">
        <h4 id="catalog-management-title">Catálogos</h4>
        <p>Administrá las categorías de servicios y las especialidades disponibles para el equipo.</p>
      </div>
      {error && <p className="catalog-management-error" role="alert">{error}</p>}
      <div className="catalog-management-grid">
        <section className="catalog-card" aria-labelledby="categories-title">
          <div className="catalog-card-title">
            <div>
              <h5 id="categories-title">Categorías de servicios</h5>
              <p>Se muestran en el formulario de servicios y en las reservas.</p>
            </div>
          </div>
          <form onSubmit={saveCategory} className="catalog-form">
            <label>
              Nombre
              <input
                required
                maxLength={80}
                value={categoryForm.name}
                onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value })}
              />
            </label>
            <label>
              Descripción (opcional)
              <input
                maxLength={240}
                value={categoryForm.description}
                onChange={(event) => setCategoryForm({ ...categoryForm, description: event.target.value })}
              />
            </label>
            <label>
              Orden
              <input
                type="number"
                min="0"
                value={categoryForm.order}
                onChange={(event) => setCategoryForm({ ...categoryForm, order: Number(event.target.value) })}
              />
            </label>
            <div className="catalog-form-actions">
              <button type="submit" className="primary-button-sm" disabled={pending}>
                {categoryForm.id ? <Pencil size={14} /> : <Plus size={14} />}
                {categoryForm.id ? 'Guardar' : 'Agregar categoría'}
              </button>
              {categoryForm.id && (
                <button
                  type="button"
                  className="catalog-cancel-button"
                  onClick={() => setCategoryForm({ id: '', name: '', description: '', order: 0 })}
                >
                  <X size={14} /> Cancelar
                </button>
              )}
            </div>
          </form>
          <ul className="catalog-list">
            {initialCategories.map((category) => (
              <li key={category.id}>
                <div>
                  <strong>{category.name}</strong>
                  {category.description && <small>{category.description}</small>}
                  <small>Orden {category.order}</small>
                </div>
                <span className="catalog-row-actions">
                  <button
                    type="button"
                    aria-label={`Editar categoría ${category.name}`}
                    onClick={() => setCategoryForm({
                      id: category.id,
                      name: category.name,
                      description: category.description || '',
                      order: category.order,
                    })}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Eliminar categoría ${category.name}`}
                    onClick={() => removeCategory(category)}
                    disabled={pending}
                  >
                    <Trash2 size={15} />
                  </button>
                </span>
              </li>
            ))}
            {!initialCategories.length && <li className="catalog-empty">Todavía no hay categorías.</li>}
          </ul>
        </section>

        <section className="catalog-card" aria-labelledby="specialties-title">
          <div className="catalog-card-title">
            <div>
              <h5 id="specialties-title">Especialidades</h5>
              <p>Una profesional puede tener varias especialidades asignadas.</p>
            </div>
          </div>
          <form onSubmit={saveSpecialty} className="catalog-form">
            <label>
              Nombre
              <input
                required
                maxLength={80}
                value={specialtyName}
                onChange={(event) => setSpecialtyName(event.target.value)}
              />
            </label>
            <div className="catalog-form-actions">
              <button type="submit" className="primary-button-sm" disabled={pending}>
                {specialtyId ? <Pencil size={14} /> : <Plus size={14} />}
                {specialtyId ? 'Guardar' : 'Agregar especialidad'}
              </button>
              {specialtyId && (
                <button
                  type="button"
                  className="catalog-cancel-button"
                  onClick={() => { setSpecialtyId(''); setSpecialtyName('') }}
                >
                  <X size={14} /> Cancelar
                </button>
              )}
            </div>
          </form>
          <ul className="catalog-list">
            {initialSpecialties.map((specialty) => (
              <li key={specialty.id}>
                <strong>{specialty.name}</strong>
                <span className="catalog-row-actions">
                  <button
                    type="button"
                    aria-label={`Editar especialidad ${specialty.name}`}
                    onClick={() => { setSpecialtyId(specialty.id); setSpecialtyName(specialty.name) }}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Eliminar especialidad ${specialty.name}`}
                    onClick={() => removeSpecialty(specialty)}
                    disabled={pending}
                  >
                    <Trash2 size={15} />
                  </button>
                </span>
              </li>
            ))}
            {!initialSpecialties.length && <li className="catalog-empty">Todavía no hay especialidades.</li>}
          </ul>
        </section>
      </div>
    </section>
  )
}
