import { integer, timestamp, text, pgTable, boolean, numeric, jsonb, uniqueIndex } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

// ----------------------------------------------------
// 1. SEGURIDAD Y USUARIOS (Better Auth & Roles)
// ----------------------------------------------------
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  role: text("role").notNull().default("receptionist"), // admin, professional, receptionist
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId").notNull(),
})

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId").notNull(),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
})

// ----------------------------------------------------
// 2. CLIENTES
// ----------------------------------------------------
export const clients = pgTable("client", {
  id: text("id").primaryKey(),
  userId: text("userId"), // Creado o asignado por un usuario (opcional si es de reserva pública)
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  birthDate: text("birthDate"),
  notes: text("notes"),
  preferences: text("preferences"),
  visits: integer("visits").notNull().default(0),
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

// ----------------------------------------------------
// 3. CATEGORÍAS, SERVICIOS, TÉCNICAS Y MATERIALES
// ----------------------------------------------------
export const serviceCategories = pgTable("service_category", {
  id: text("id").primaryKey(),
  name: text("name").notNull(), // MANOS, PIES, PESTAÑAS, etc.
  slug: text("slug").notNull().unique(),
  description: text("description"),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const services = pgTable("service", {
  id: text("id").primaryKey(),
  categoryId: text("categoryId").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  price: numeric("price", { precision: 12, scale: 2 }).notNull(), // ARS
  durationMinutes: integer("durationMinutes").notNull(), // duración neta
  prepMinutes: integer("prepMinutes").notNull().default(0), // preparación
  cleanupMinutes: integer("cleanupMinutes").notNull().default(0), // limpieza/desinfección
  depositType: text("depositType").notNull().default("fixed"), // fixed o percentage
  depositValue: numeric("depositValue", { precision: 12, scale: 2 }).notNull().default("0"),
  allowPublicBooking: boolean("allowPublicBooking").notNull().default(true),
  isActive: boolean("isActive").notNull().default(true),
  cancellationPolicy: text("cancellationPolicy"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const techniques = pgTable("technique", {
  id: text("id").primaryKey(),
  serviceId: text("serviceId").notNull(),
  name: text("name").notNull(), // Acrílico, Gel, Polygel, etc.
  description: text("description"),
  additionalPrice: numeric("additionalPrice", { precision: 12, scale: 2 }).notNull().default("0"),
  additionalMinutes: integer("additionalMinutes").notNull().default(0),
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const materials = pgTable("material", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(), // Esmaltes, Limas, Pestañas, Líquidos, etc.
  unit: text("unit").notNull(), // unidad, ml, gr, kit
  currentStock: numeric("currentStock", { precision: 12, scale: 2 }).notNull().default("0"),
  minStock: numeric("minStock", { precision: 12, scale: 2 }).notNull().default("5"),
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const serviceMaterials = pgTable("service_material", {
  id: text("id").primaryKey(),
  serviceId: text("serviceId").notNull(),
  techniqueId: text("techniqueId"),
  materialId: text("materialId").notNull(),
  estimatedUsage: numeric("estimatedUsage", { precision: 10, scale: 2 }).notNull().default("1"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

// ----------------------------------------------------
// 4. PROFESIONALES, HORARIOS, AUSENCIAS Y BLOQUEOS
// ----------------------------------------------------
export const professionals = pgTable("professional", {
  id: text("id").primaryKey(),
  userId: text("userId"), // Puede estar vinculado a una cuenta de usuario
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  specialties: text("specialties"),
  initials: text("initials"),
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const specialties = pgTable("specialty", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("specialty_name_lower_unique").on(sql`lower(${table.name})`),
])

export const professionalSpecialties = pgTable("professional_specialty", {
  id: text("id").primaryKey(),
  professionalId: text("professionalId").notNull().references(() => professionals.id, { onDelete: "cascade" }),
  specialtyId: text("specialtyId").notNull().references(() => specialties.id, { onDelete: "restrict" }),
}, (table) => [
  uniqueIndex("professional_specialty_pair_unique").on(table.professionalId, table.specialtyId),
])

export const professionalServices = pgTable("professional_service", {
  id: text("id").primaryKey(),
  professionalId: text("professionalId").notNull(),
  serviceId: text("serviceId").notNull(),
})

export const professionalSchedules = pgTable("professional_schedule", {
  id: text("id").primaryKey(),
  professionalId: text("professionalId").notNull(),
  dayOfWeek: integer("dayOfWeek").notNull(), // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
  startTime: text("startTime").notNull(), // "09:00"
  endTime: text("endTime").notNull(), // "19:00"
  breakStartTime: text("breakStartTime"), // "13:00" (descanso)
  breakEndTime: text("breakEndTime"), // "14:00"
  isActive: boolean("isActive").notNull().default(true),
})

export const professionalAbsences = pgTable("professional_absence", {
  id: text("id").primaryKey(),
  professionalId: text("professionalId").notNull(),
  startDate: text("startDate").notNull(), // "YYYY-MM-DD" o ISO
  endDate: text("endDate").notNull(),
  reason: text("reason").notNull(), // Vacaciones, Ausencia, etc.
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const scheduleBlocks = pgTable("schedule_block", {
  id: text("id").primaryKey(),
  professionalId: text("professionalId"), // Si es null, bloquea a todo el salón
  startDateTime: timestamp("startDateTime").notNull(),
  endDateTime: timestamp("endDateTime").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

// ----------------------------------------------------
// 5. TURNOS / RESERVAS
// ----------------------------------------------------
export const appointments = pgTable("appointment", {
  id: text("id").primaryKey(),
  clientId: text("clientId").notNull(),
  professionalId: text("professionalId").notNull(),
  startDateTime: timestamp("startDateTime").notNull(),
  endDateTime: timestamp("endDateTime").notNull(),
  totalDurationMinutes: integer("totalDurationMinutes").notNull(),
  totalPrice: numeric("totalPrice", { precision: 12, scale: 2 }).notNull(), // ARS
  requiredDeposit: numeric("requiredDeposit", { precision: 12, scale: 2 }).notNull().default("0"),
  status: text("status").notNull().default("pending_confirmation"),
  // Estados válidos:
  // 'pending_confirmation', 'confirmed', 'waiting', 'in_progress', 'completed', 'cancelled', 'no_show'
  paymentStatus: text("paymentStatus").notNull().default("pending"),
  // Estados de pago:
  // 'pending', 'deposit_paid', 'partially_paid', 'paid', 'refunded'
  notes: text("notes"),
  clientPreferences: text("clientPreferences"),
  isPublicBooking: boolean("isPublicBooking").notNull().default(false),
  cancellationReason: text("cancellationReason"),
  cancelledAt: timestamp("cancelledAt"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

// Detalle de servicios contratados en el turno (copia histórica para inmutabilidad)
export const appointmentServices = pgTable("appointment_service", {
  id: text("id").primaryKey(),
  appointmentId: text("appointmentId").notNull(),
  serviceId: text("serviceId").notNull(),
  techniqueId: text("techniqueId"),
  historicServiceName: text("historicServiceName").notNull(),
  historicTechniqueName: text("historicTechniqueName"),
  historicPrice: numeric("historicPrice", { precision: 12, scale: 2 }).notNull(),
  historicDurationMinutes: integer("historicDurationMinutes").notNull(),
  historicPrepMinutes: integer("historicPrepMinutes").notNull().default(0),
  historicCleanupMinutes: integer("historicCleanupMinutes").notNull().default(0),
  sequenceOrder: integer("sequenceOrder").notNull().default(1),
})

export const appointmentHistory = pgTable("appointment_history", {
  id: text("id").primaryKey(),
  appointmentId: text("appointmentId").notNull(),
  action: text("action").notNull(), // created, rescheduled, status_change, cancelled, etc.
  actorUserId: text("actorUserId"),
  details: text("details"),
  snapshot: jsonb("snapshot"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const coupons = pgTable("coupon", {
  id: text("id").primaryKey(),
  code: text("code").notNull(),
  description: text("description").notNull(),
  discountType: text("discountType").notNull(), // percentage o fixed
  discountValue: numeric("discountValue", { precision: 12, scale: 2 }).notNull(),
  minimumPurchase: numeric("minimumPurchase", { precision: 12, scale: 2 }).notNull().default("0"),
  startDate: text("startDate").notNull(),
  endDate: text("endDate").notNull(),
  maxUses: integer("maxUses"),
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("coupon_code_lower_unique").on(sql`lower(${table.code})`),
])

export const couponRedemptions = pgTable("coupon_redemption", {
  id: text("id").primaryKey(),
  couponId: text("couponId").notNull().references(() => coupons.id, { onDelete: "restrict" }),
  appointmentId: text("appointmentId").notNull().references(() => appointments.id, { onDelete: "cascade" }),
  codeSnapshot: text("codeSnapshot").notNull(),
  discountAmount: numeric("discountAmount", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
}, (table) => [
  uniqueIndex("coupon_redemption_appointment_unique").on(table.appointmentId),
])

// ----------------------------------------------------
// 6. FINANZAS Y PAGOS
// ----------------------------------------------------
export const payments = pgTable("payment", {
  id: text("id").primaryKey(),
  appointmentId: text("appointmentId").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  method: text("method").notNull(), // cash, transfer, card, other
  type: text("type").notNull(), // deposit, partial, full, refund
  status: text("status").notNull().default("completed"),
  notes: text("notes"),
  referenceNumber: text("referenceNumber"), // ID transferencia, ticket, comprobante
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

// ----------------------------------------------------
// 7. INVENTARIO Y MOVIMIENTOS
// ----------------------------------------------------
export const inventoryMovements = pgTable("inventory_movement", {
  id: text("id").primaryKey(),
  materialId: text("materialId").notNull(),
  type: text("type").notNull(), // in (ingreso), out (consumo servicio), adjustment (ajuste manual), waste (merma)
  quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull(),
  reason: text("reason").notNull(),
  appointmentId: text("appointmentId"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

// ----------------------------------------------------
// 8. CONFIGURACIONES GENERALES DEL SALÓN
// ----------------------------------------------------
export const salonSettings = pgTable("salon_setting", {
  id: text("id").primaryKey(),
  salonName: text("salonName").notNull().default("Atelier Beauty Studio"),
  timeZone: text("timeZone").notNull().default("America/Argentina/Buenos_Aires"),
  currency: text("currency").notNull().default("ARS"),
  minNoticeHoursForBooking: integer("minNoticeHoursForBooking").notNull().default(2),
  minNoticeHoursForCancellation: integer("minNoticeHoursForCancellation").notNull().default(24),
  autoConfirmPublicBookings: boolean("autoConfirmPublicBookings").notNull().default(false),
  defaultDepositType: text("defaultDepositType").notNull().default("percentage"), // percentage o fixed
  defaultDepositPercentage: integer("defaultDepositPercentage").notNull().default(30),
  defaultDepositFixed: numeric("defaultDepositFixed", { precision: 12, scale: 2 }).notNull().default("5000"),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const salonInvitations = pgTable("salon_invitation", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  tokenHash: text("tokenHash").notNull().unique(),
  role: text("role").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  acceptedAt: timestamp("acceptedAt"),
  createdBy: text("createdBy"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})
