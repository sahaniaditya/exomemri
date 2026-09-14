
'server-only'
'use server'

import { cookies } from 'next/headers'
import { getSpaceCoverage } from '@/lib/coverage'

export async function calculateCoverageAction(spaceId: string): Promise<number | null> {
  const token = (await cookies()).get('atlas_token')?.value ?? ''
  
  // Call your backend/service calculation endpoint on demand
  const coverageData = await getSpaceCoverage(token, spaceId)



  
  return coverageData.coverage_pct !=null ? coverageData.coverage_pct : null
}