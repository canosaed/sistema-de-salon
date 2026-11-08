import { date, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const publicAppointments = pgTable('appointment', {
  id: text('id').primaryKey(),
  userId: text('userId').notNull(),
  client: text('client').notNull(),
  service: text('service').notNull(),
  appointmentDate: date('appointmentDate', { mode: 'string' }).notNull(),
  appointmentTime: text('appointmentTime').notNull(),
  professional: text('professional').notNull(),
  status: text('status').notNull().default('Pendiente'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})
