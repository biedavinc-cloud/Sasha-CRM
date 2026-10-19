import { describe, test, vi } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'
import { screen, userEvent, expect } from './helpers.jsx'
import TempPasswordDialog from '@/components/crm/TempPasswordDialog.jsx'

describe('TempPasswordDialog', () => {
  test('shows the login details once and closes', async () => {
    const onClose = vi.fn()
    render(<TempPasswordDialog creds={{ email: 'new@partner.com', password: 'AbCd-EfGh-JkLm-NpQr' }} onClose={onClose} title="Partner login details" />)
    expect((await screen.findByTestId('temp-password')).textContent).toBe('AbCd-EfGh-JkLm-NpQr')
    expect(screen.getByText('new@partner.com')).toBeTruthy()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Done' }))
    expect(onClose).toHaveBeenCalled()
  })
  test('renders nothing when there are no credentials', () => {
    render(<TempPasswordDialog creds={null} onClose={() => {}} />)
    expect(screen.queryByTestId('temp-password')).toBeNull()
  })
})
