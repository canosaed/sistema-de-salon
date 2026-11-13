CREATE TABLE "coupon_redemption" (
	"id" text PRIMARY KEY NOT NULL,
	"couponId" text NOT NULL,
	"appointmentId" text NOT NULL,
	"codeSnapshot" text NOT NULL,
	"discountAmount" numeric(12, 2) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coupon" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"description" text NOT NULL,
	"discountType" text NOT NULL,
	"discountValue" numeric(12, 2) NOT NULL,
	"minimumPurchase" numeric(12, 2) DEFAULT '0' NOT NULL,
	"startDate" text NOT NULL,
	"endDate" text NOT NULL,
	"maxUses" integer,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "coupon_redemption" ADD CONSTRAINT "coupon_redemption_couponId_coupon_id_fk" FOREIGN KEY ("couponId") REFERENCES "public"."coupon"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_redemption" ADD CONSTRAINT "coupon_redemption_appointmentId_appointment_id_fk" FOREIGN KEY ("appointmentId") REFERENCES "public"."appointment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "coupon_redemption_appointment_unique" ON "coupon_redemption" USING btree ("appointmentId");--> statement-breakpoint
CREATE UNIQUE INDEX "coupon_code_lower_unique" ON "coupon" USING btree (lower("code"));