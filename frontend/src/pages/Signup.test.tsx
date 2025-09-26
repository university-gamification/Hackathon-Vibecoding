/* @vitest-environment jsdom */
/*
Testing framework: Vitest
Testing utilities: React Testing Library + @testing-library/jest-dom
Reason: Project uses Vite (frontend/vite.config.ts) but no existing test setup was found.
This test file sets jsdom per-file and imports jest-dom matchers directly.
*/

import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import Signup from './Signup'
import * as api from '../api'

// Mock the API functions used by the component
vi.mock('../api', () => ({
  register: vi.fn(),
  login: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number
    url: string
    body: string
    constructor(status: number, url: string, body: string) {
      super(`API Error ${status}`)
      this.name = 'ApiError'
      this.status = status
      this.url = url
      this.body = body
    }
  }
}))

// Mock react-router-dom navigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate
  }
})

const renderSignup = () =>
  render(
    <BrowserRouter>
      <Signup />
    </BrowserRouter>
  )

describe('Signup Component (Vitest + Testing Library)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Initial Render', () => {
    it('renders headings, inputs, and submit button', () => {
      renderSignup()

      expect(screen.getByRole('heading', { name: /create your account/i })).toBeInTheDocument()
      expect(screen.getByText(/sign up to upload knowledge sources/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument()
    })

    it('ensures inputs and button have correct attributes and initial state', () => {
      renderSignup()

      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const submitButton = screen.getByRole('button', { name: /create account/i })

      expect(emailInput).toHaveAttribute('type', 'email')
      expect(emailInput).toHaveAttribute('required')
      expect(passwordInput).toHaveAttribute('type', 'password')
      expect(passwordInput).toHaveAttribute('required')
      expect(submitButton).toHaveAttribute('type', 'submit')
      expect(submitButton).not.toBeDisabled()
    })

    it('starts with empty input values and no error displayed', () => {
      renderSignup()

      const emailInput = screen.getByLabelText(/email/i) as HTMLInputElement
      const passwordInput = screen.getByLabelText(/password/i) as HTMLInputElement
      expect(emailInput.value).toBe('')
      expect(passwordInput.value).toBe('')
      expect(screen.queryByText(/failed to sign up/i)).not.toBeInTheDocument()
    })
  })

  describe('Input Handling', () => {
    it('updates email and password fields when user types', () => {
      renderSignup()

      const emailInput = screen.getByLabelText(/email/i) as HTMLInputElement
      const passwordInput = screen.getByLabelText(/password/i) as HTMLInputElement

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'password123' } })

      expect(emailInput.value).toBe('test@example.com')
      expect(passwordInput.value).toBe('password123')
    })

    it('allows clearing input values', () => {
      renderSignup()

      const emailInput = screen.getByLabelText(/email/i) as HTMLInputElement
      const passwordInput = screen.getByLabelText(/password/i) as HTMLInputElement

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'password123' } })
      fireEvent.change(emailInput, { target: { value: '' } })
      fireEvent.change(passwordInput, { target: { value: '' } })

      expect(emailInput.value).toBe('')
      expect(passwordInput.value).toBe('')
    })

    it('supports special characters in inputs', () => {
      renderSignup()

      const emailInput = screen.getByLabelText(/email/i) as HTMLInputElement
      const passwordInput = screen.getByLabelText(/password/i) as HTMLInputElement

      fireEvent.change(emailInput, { target: { value: 'test+user@domain-name.com' } })
      fireEvent.change(passwordInput, { target: { value: 'P@ssw0rd\!123#$%' } })

      expect(emailInput.value).toBe('test+user@domain-name.com')
      expect(passwordInput.value).toBe('P@ssw0rd\!123#$%')
    })
  })

  describe('Form Submission – Success Path', () => {
    it('registers, logs in, and navigates on successful submission', async () => {
      vi.mocked(api.register).mockResolvedValueOnce(undefined)
      vi.mocked(api.login).mockResolvedValueOnce(undefined)

      renderSignup()

      fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } })
      fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } })
      fireEvent.click(screen.getByRole('button', { name: /create account/i }))

      await waitFor(() => {
        expect(api.register).toHaveBeenCalledWith('test@example.com', 'password123')
        expect(api.login).toHaveBeenCalledWith('test@example.com', 'password123')
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
      })
    })

    it('shows loading state while submitting and reverts after completion', async () => {
      vi.mocked(api.register).mockImplementation(() => new Promise(resolve => setTimeout(resolve, 80)))
      vi.mocked(api.login).mockResolvedValueOnce(undefined)

      renderSignup()

      fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } })
      fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } })
      fireEvent.click(screen.getByRole('button', { name: /create account/i }))

      expect(screen.getByRole('button', { name: /creating\.\.\./i })).toBeDisabled()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create account/i })).not.toBeDisabled()
      })
    })

    it('clears previous error on retry and navigates when retry succeeds', async () => {
      vi.mocked(api.register).mockRejectedValueOnce(new Error('Network error'))

      renderSignup()

      fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } })
      fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } })
      fireEvent.click(screen.getByRole('button', { name: /create account/i }))

      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument()
      })

      vi.mocked(api.register).mockResolvedValueOnce(undefined)
      vi.mocked(api.login).mockResolvedValueOnce(undefined)

      fireEvent.click(screen.getByRole('button', { name: /create account/i }))

      await waitFor(() => {
        expect(screen.queryByText(/network error/i)).not.toBeInTheDocument()
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
      })
    })
  })

  describe('Form Submission – Error Handling', () => {
    it('shows detailed message when register throws ApiError', async () => {
      const apiError = new api.ApiError(400, '/api/register', 'Email already exists')
      vi.mocked(api.register).mockRejectedValueOnce(apiError)

      renderSignup()

      fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'existing@example.com' } })
      fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } })
      fireEvent.click(screen.getByRole('button', { name: /create account/i }))

      await waitFor(() => {
        expect(screen.getByText(/signup failed \(400\) at \/api\/register\. response: email already exists/i)).toBeInTheDocument()
      })
      expect(api.login).not.toHaveBeenCalled()
      expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('shows detailed message when login throws ApiError', async () => {
      vi.mocked(api.register).mockResolvedValueOnce(undefined)
      const apiError = new api.ApiError(401, '/api/login', 'Invalid credentials')
      vi.mocked(api.login).mockRejectedValueOnce(apiError)

      renderSignup()

      fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } })
      fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrongpassword' } })
      fireEvent.click(screen.getByRole('button', { name: /create account/i }))

      await waitFor(() => {
        expect(screen.getByText(/signup failed \(401\) at \/api\/login\. response: invalid credentials/i)).toBeInTheDocument()
      })
      expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('shows specific message when a standard Error is thrown', async () => {
      vi.mocked(api.register).mockRejectedValueOnce(new Error('Network connection failed'))

      renderSignup()

      fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } })
      fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } })
      fireEvent.click(screen.getByRole('button', { name: /create account/i }))

      await waitFor(() => {
        expect(screen.getByText('Network connection failed')).toBeInTheDocument()
      })
    })

    it('falls back to default message when thrown value lacks message (object)', async () => {
      vi.mocked(api.register).mockRejectedValueOnce({})

      renderSignup()

      fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } })
      fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } })
      fireEvent.click(screen.getByRole('button', { name: /create account/i }))

      await waitFor(() => {
        expect(screen.getByText('Failed to sign up')).toBeInTheDocument()
      })
    })

    it('falls back to default message when a non-Error primitive is thrown', async () => {
      // e.g., throwing a string
      vi.mocked(api.register).mockRejectedValueOnce('boom' as any)

      renderSignup()

      fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } })
      fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } })
      fireEvent.click(screen.getByRole('button', { name: /create account/i }))

      await waitFor(() => {
        expect(screen.getByText('Failed to sign up')).toBeInTheDocument()
      })
    })

    it('re-enables button after failure', async () => {
      vi.mocked(api.register).mockRejectedValueOnce(new Error('Server error'))

      renderSignup()

      fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } })
      fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } })
      const submitButton = screen.getByRole('button', { name: /create account/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText('Server error')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /create account/i })).not.toBeDisabled()
      })
    })
  })

  describe('Validation and Edge Cases', () => {
    it('submits whitespace-only inputs and surfaces backend response', async () => {
      vi.mocked(api.register).mockRejectedValueOnce(new Error('Invalid email'))

      renderSignup()

      fireEvent.change(screen.getByLabelText(/email/i), { target: { value: '   ' } })
      fireEvent.change(screen.getByLabelText(/password/i), { target: { value: '   ' } })
      fireEvent.click(screen.getByRole('button', { name: /create account/i }))

      await waitFor(() => {
        expect(api.register).toHaveBeenCalledWith('   ', '   ')
        expect(screen.getByText('Invalid email')).toBeInTheDocument()
      })
    })

    it('handles very long inputs without breaking', async () => {
      vi.mocked(api.register).mockResolvedValueOnce(undefined)
      vi.mocked(api.login).mockResolvedValueOnce(undefined)

      renderSignup()

      const longEmail = `${'a'.repeat(120)}@example.com`
      const longPassword = `P@ss${'x'.repeat(120)}word`

      fireEvent.change(screen.getByLabelText(/email/i), { target: { value: longEmail } })
      fireEvent.change(screen.getByLabelText(/password/i), { target: { value: longPassword } })
      fireEvent.click(screen.getByRole('button', { name: /create account/i }))

      await waitFor(() => {
        expect(api.register).toHaveBeenCalledWith(longEmail, longPassword)
      })
    })

    it('prevents multiple submits via disabled state (only first click counts)', async () => {
      vi.mocked(api.register).mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))
      vi.mocked(api.login).mockResolvedValueOnce(undefined)

      renderSignup()

      fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } })
      fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } })

      const submitButton = screen.getByRole('button', { name: /create account/i })
      fireEvent.click(submitButton)
      fireEvent.click(submitButton)
      fireEvent.click(submitButton)

      expect(submitButton).toBeDisabled()

      await waitFor(() => {
        expect(api.register).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe('Error Message Presentation', () => {
    it('renders error in a PRE.error with pre-wrap', async () => {
      vi.mocked(api.register).mockRejectedValueOnce(new Error('Test error'))

      renderSignup()

      fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } })
      fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } })
      fireEvent.click(screen.getByRole('button', { name: /create account/i }))

      await waitFor(() => {
        const errorNode = screen.getByText('Test error')
        expect(errorNode).toBeInTheDocument()
        expect(errorNode.tagName).toBe('PRE')
        expect(errorNode).toHaveClass('error')
        expect(errorNode).toHaveStyle({ whiteSpace: 'pre-wrap' })
      })
    })

    it('supports multiline error messages', async () => {
      const multilineError = 'Line 1\nLine 2\nLine 3'
      vi.mocked(api.register).mockRejectedValueOnce(new Error(multilineError))

      renderSignup()

      fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } })
      fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } })
      fireEvent.click(screen.getByRole('button', { name: /create account/i }))

      await waitFor(() => {
        expect(screen.getByText(multilineError)).toBeInTheDocument()
      })
    })
  })

  describe('Accessibility', () => {
    it('provides accessible labels for inputs', () => {
      renderSignup()

      expect(screen.getByLabelText(/email/i)).toHaveAccessibleName('Email')
      expect(screen.getByLabelText(/password/i)).toHaveAccessibleName('Password')
    })

    it('maintains focus on inputs during loading state', async () => {
      vi.mocked(api.register).mockImplementation(() => new Promise(resolve => setTimeout(resolve, 50)))
      vi.mocked(api.login).mockResolvedValueOnce(undefined)

      renderSignup()

      const emailInput = screen.getByLabelText(/email/i)
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
      fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } })

      emailInput.focus()
      fireEvent.click(screen.getByRole('button', { name: /create account/i }))

      expect(emailInput).toHaveFocus()

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
      })
    })
  })
})