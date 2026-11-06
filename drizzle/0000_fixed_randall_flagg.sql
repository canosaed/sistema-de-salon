CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"accountId" text NOT NULL,
	"providerId" text NOT NULL,
	"userId" text NOT NULL,
	"accessToken" text,
	"refreshToken" text,
	"idToken" text,
	"accessTokenExpiresAt" timestamp,
	"refreshTokenExpiresAt" timestamp,
	"scope" text,
	"password" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appointment_history" (
	"id" text PRIMARY KEY NOT NULL,
	"appointmentId" text NOT NULL,
	"action" text NOT NULL,
	"actorUserId" text,
	"details" text,
	"snapshot" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appointment_service" (
	"id" text PRIMARY KEY NOT NULL,
	"appointmentId" text NOT NULL,
	"serviceId" text NOT NULL,
	"techniqueId" text,
	"historicServiceName" text NOT NULL,
	"historicTechniqueName" text,
	"historicPrice" numeric(12, 2) NOT NULL,
	"historicDurationMinutes" integer NOT NULL,
	"historicPrepMinutes" integer DEFAULT 0 NOT NULL,
	"historicCleanupMinutes" integer DEFAULT 0 NOT NULL,
	"sequenceOrder" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appointment" (
	"id" text PRIMARY KEY NOT NULL,
	"clientId" text NOT NULL,
	"professionalId" text NOT NULL,
	"startDateTime" timestamp NOT NULL,
	"endDateTime" timestamp NOT NULL,
	"totalDurationMinutes" integer NOT NULL,
	"totalPrice" numeric(12, 2) NOT NULL,
	"requiredDeposit" numeric(12, 2) DEFAULT '0' NOT NULL,
	"status" text DEFAULT 'pending_confirmation' NOT NULL,
	"paymentStatus" text DEFAULT 'pending' NOT NULL,
	"notes" text,
	"clientPreferences" text,
	"isPublicBooking" boolean DEFAULT false NOT NULL,
	"cancellationReason" text,
	"cancelledAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"birthDate" text,
	"notes" text,
	"preferences" text,
	"visits" integer DEFAULT 0 NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_movement" (
	"id" text PRIMARY KEY NOT NULL,
	"materialId" text NOT NULL,
	"type" text NOT NULL,
	"quantity" numeric(10, 2) NOT NULL,
	"reason" text NOT NULL,
	"appointmentId" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "material" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"unit" text NOT NULL,
	"currentStock" numeric(12, 2) DEFAULT '0' NOT NULL,
	"minStock" numeric(12, 2) DEFAULT '5' NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment" (
	"id" text PRIMARY KEY NOT NULL,
	"appointmentId" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"method" text NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'completed' NOT NULL,
	"notes" text,
	"referenceNumber" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "professional_absence" (
	"id" text PRIMARY KEY NOT NULL,
	"professionalId" text NOT NULL,
	"startDate" text NOT NULL,
	"endDate" text NOT NULL,
	"reason" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "professional_schedule" (
	"id" text PRIMARY KEY NOT NULL,
	"professionalId" text NOT NULL,
	"dayOfWeek" integer NOT NULL,
	"startTime" text NOT NULL,
	"endTime" text NOT NULL,
	"breakStartTime" text,
	"breakEndTime" text,
	"isActive" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "professional_service" (
	"id" text PRIMARY KEY NOT NULL,
	"professionalId" text NOT NULL,
	"serviceId" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "professional" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"specialties" text,
	"initials" text,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "salon_setting" (
	"id" text PRIMARY KEY NOT NULL,
	"salonName" text DEFAULT 'Atelier Beauty Studio' NOT NULL,
	"timeZone" text DEFAULT 'America/Argentina/Buenos_Aires' NOT NULL,
	"currency" text DEFAULT 'ARS' NOT NULL,
	"minNoticeHoursForBooking" integer DEFAULT 2 NOT NULL,
	"minNoticeHoursForCancellation" integer DEFAULT 24 NOT NULL,
	"autoConfirmPublicBookings" boolean DEFAULT false NOT NULL,
	"defaultDepositType" text DEFAULT 'percentage' NOT NULL,
	"defaultDepositPercentage" integer DEFAULT 30 NOT NULL,
	"defaultDepositFixed" numeric(12, 2) DEFAULT '5000' NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedule_block" (
	"id" text PRIMARY KEY NOT NULL,
	"professionalId" text,
	"startDateTime" timestamp NOT NULL,
	"endDateTime" timestamp NOT NULL,
	"reason" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_category" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"order" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "service_category_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "service_material" (
	"id" text PRIMARY KEY NOT NULL,
	"serviceId" text NOT NULL,
	"techniqueId" text,
	"materialId" text NOT NULL,
	"estimatedUsage" numeric(10, 2) DEFAULT '1' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service" (
	"id" text PRIMARY KEY NOT NULL,
	"categoryId" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price" numeric(12, 2) NOT NULL,
	"durationMinutes" integer NOT NULL,
	"prepMinutes" integer DEFAULT 0 NOT NULL,
	"cleanupMinutes" integer DEFAULT 0 NOT NULL,
	"depositType" text DEFAULT 'fixed' NOT NULL,
	"depositValue" numeric(12, 2) DEFAULT '0' NOT NULL,
	"allowPublicBooking" boolean DEFAULT true NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"cancellationPolicy" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"token" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"ipAddress" text,
	"userAgent" text,
	"userId" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "technique" (
	"id" text PRIMARY KEY NOT NULL,
	"serviceId" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"additionalPrice" numeric(12, 2) DEFAULT '0' NOT NULL,
	"additionalMinutes" integer DEFAULT 0 NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"emailVerified" timestamp,
	"image" text,
	"role" text DEFAULT 'receptionist' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now(),
	"updatedAt" timestamp DEFAULT now()
);
