import { runObligatoryScenariosTests } from '@/lib/test-runner'
import { NextResponse } from 'next/server'

export async function GET() {
  const testResults = runObligatoryScenariosTests()
  const allPassed = testResults.every((r) => r.passed)

  return NextResponse.json({
    status: allPassed ? 'success' : 'failed',
    totalTests: testResults.length,
    passedCount: testResults.filter((r) => r.passed).length,
    results: testResults,
  })
}
