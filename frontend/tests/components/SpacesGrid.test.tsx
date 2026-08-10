import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import userEvent from '@testing-library/user-event'
import SpacesGrid from '@/components/dashboard/SpacesGrid'
import type { LearningSpace } from '@/lib/dashboard-data'

const pushMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}))

function makeSpace(overrides: Partial<LearningSpace> = {}): LearningSpace {
  return {
    id: 'space-1',
    name: 'Machine Learning',
    slug: 'machine-learning',
    coverage: 0,
    counts: { video: 1, article: 2, pdf: 0, chat: 3, note: 0 },
    lastActive: '1 day ago',
    ...overrides,
  }
}

describe('SpacesGrid', () => {
  beforeEach(() => {
    pushMock.mockClear()
  })

  it('renders exactly one button per space, with no nested buttons', () => {
    const spaces: LearningSpace[] = [
      makeSpace({ id: 'space-1', name: 'Machine Learning' }),
      makeSpace({ id: 'space-2', name: 'Distributed Systems' }),
    ]

    render(<SpacesGrid spaces={spaces} />)

    const playButtons = spaces.map(space =>
      screen.getByRole('button', { name: `Open ${space.name}` }),
    )
    expect(playButtons).toHaveLength(spaces.length)

    for (const button of playButtons) {
      // The pre-fix markup wrapped PlayButton's own <button> in another
      // <button onClick=...>, which is invalid nested HTML and triggers a
      // hydration error. Assert no button-in-button nesting anywhere in the grid.
      expect(button.closest('button')).toBe(button)
      expect(button.querySelector('button')).toBeNull()
    }

    // No button in the whole grid should contain another button as a descendant.
    const allButtons = screen.getAllByRole('button')
    for (const button of allButtons) {
      expect(button.querySelector('button')).toBeNull()
    }
  })

  it('navigates to /dashboard/spaces/{id} when the play button is clicked', async () => {
    const user = userEvent.setup()
    const spaces: LearningSpace[] = [makeSpace({ id: 'space-42', name: 'Systems Design' })]

    render(<SpacesGrid spaces={spaces} />)

    const button = screen.getByRole('button', { name: 'Open Systems Design' })
    await user.click(button)

    expect(pushMock).toHaveBeenCalledTimes(1)
    expect(pushMock).toHaveBeenCalledWith('/dashboard/spaces/space-42')
  })
})
