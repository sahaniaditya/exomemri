import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CaptureFeed from '@/components/dashboard/CaptureFeed'
import type { CapturedSource } from '@/lib/dashboard-data'

function makeSource(overrides: Partial<CapturedSource> = {}): CapturedSource {
  return {
    id: 'source-1',
    title: 'Intro to Neural Networks',
    spaceName: 'Machine Learning',
    spaceId: 'space-1',
    kind: 'video',
    meta: '12 min',
    capturedAt: '2 hours ago',
    status: 'summarized',
    ...overrides,
  }
}

describe('CaptureFeed', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  it('renders each source without triggering a React "unique key" warning', () => {
    const sources: CapturedSource[] = [
      makeSource({ id: 'source-1', title: 'First capture', spaceId: 'space-1' }),
      makeSource({ id: 'source-2', title: 'Second capture', spaceId: 'space-1' }),
      makeSource({ id: 'source-3', title: 'Third capture', spaceId: 'space-2' }),
    ]

    render(<CaptureFeed sources={sources} />)

    const keyWarning = consoleErrorSpy.mock.calls.some(call =>
      call.some(
        arg => typeof arg === 'string' && arg.includes('unique "key" prop'),
      ),
    )
    expect(keyWarning).toBe(false)
  })

  it('links each rendered source to /dashboard/spaces/{spaceId}/sources/{id}', () => {
    const sources: CapturedSource[] = [
      makeSource({ id: 'source-1', title: 'First capture', spaceId: 'space-1' }),
      makeSource({ id: 'source-2', title: 'Second capture', spaceId: 'space-2' }),
    ]

    render(<CaptureFeed sources={sources} />)

    const firstLink = screen.getByText('First capture').closest('a')
    const secondLink = screen.getByText('Second capture').closest('a')

    expect(firstLink).toHaveAttribute('href', '/dashboard/spaces/space-1/sources/source-1')
    expect(secondLink).toHaveAttribute('href', '/dashboard/spaces/space-2/sources/source-2')
  })

  it('renders the empty state when there are no sources', () => {
    render(<CaptureFeed sources={[]} />)

    expect(screen.getByText('No captures yet')).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
