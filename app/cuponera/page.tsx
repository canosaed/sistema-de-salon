import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import CouponManagement from '@/components/coupon-management'
import { getCouponsAction } from '@/app/actions/coupons'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { user } from '@/lib/db/schema'

export default async function CouponsPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/sign-in')

  const [account] = await db.select({ role: user.role, isActive: user.isActive })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1)
  if (!account?.isActive || account.role !== 'admin') redirect('/')

  const coupons = await getCouponsAction()
  return <CouponManagement initialCoupons={coupons} />
}
