import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { BrowserRouter } from 'react-router-dom'
import Login from './Login'
import { login } from '../api'
import { ApiError } from '../api'

// Mock the login API function
vi.mock('../api', () => ({
  login: vi.fn(),
  ApiError: class extends Error {
    constructor(public status: number, public url: string, public body: string) {
      super(`API Error: ${status}`)
      this.name = 'ApiError'
    }
  }
}))

// Mock react-router-dom
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate
  }
})

// Helper function to render component with router
function renderLogin() {
  return render(
    <BrowserRouter>
      <Login />
    </BrowserRouter>
  )
}

describe('Login Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering', () => {
    it('renders login form with all required elements', () => {
      renderLogin()
      
      expect(screen.getByText('Welcome back')).toBeInTheDocument()
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
    })

    it('renders email input with correct attributes', () => {
      renderLogin()
      
      const emailInput = screen.getByLabelText(/email/i)
      expect(emailInput).toHaveAttribute('type', 'email')
      expect(emailInput).toHaveAttribute('required')
    })

    it('renders password input with correct attributes', () => {
      renderLogin()
      
      const passwordInput = screen.getByLabelText(/password/i)
      expect(passwordInput).toHaveAttribute('type', 'password')
      expect(passwordInput).toHaveAttribute('required')
    })

    it('applies correct CSS classes', () => {
      renderLogin()
      
      expect(screen.getByText('Welcome back').closest('div')).toHaveClass('container', 'narrow')
      expect(screen.getByRole('form')).toHaveClass('form')
      expect(screen.getByRole('button')).toHaveClass('btn')
    })
  })

  describe('Form Input Handling', () => {
    it('updates email state when typing in email input', async () => {
      renderLogin()
      
      const emailInput = screen.getByLabelText(/email/i) as HTMLInputElement
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
      
      expect(emailInput.value).toBe('test@example.com')
    })

    it('updates password state when typing in password input', async () => {
      renderLogin()
      
      const passwordInput = screen.getByLabelText(/password/i) as HTMLInputElement
      fireEvent.change(passwordInput, { target: { value: 'testpassword' } })
      
      expect(passwordInput.value).toBe('testpassword')
    })

    it('handles empty input values', () => {
      renderLogin()
      
      const emailInput = screen.getByLabelText(/email/i) as HTMLInputElement
      const passwordInput = screen.getByLabelText(/password/i) as HTMLInputElement
      
      expect(emailInput.value).toBe('')
      expect(passwordInput.value).toBe('')
    })

    it('handles special characters in inputs', async () => {
      renderLogin()
      
      const emailInput = screen.getByLabelText(/email/i) as HTMLInputElement
      const passwordInput = screen.getByLabelText(/password/i) as HTMLInputElement
      
      fireEvent.change(emailInput, { target: { value: 'user+test@domain-name.co.uk' } })
      fireEvent.change(passwordInput, { target: { value: 'P@ssw0rd\\!@#$%' } })
      
      expect(emailInput.value).toBe('user+test@domain-name.co.uk')
      expect(passwordInput.value).toBe('P@ssw0rd\\!@#$%')
    })
  })

  describe('Form Submission - Success Cases', () => {
    it('handles successful login', async () => {
      vi.mocked(login).mockResolvedValue(undefined)
      renderLogin()
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const submitButton = screen.getByRole('button', { name: /sign in/i })
      
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'password123' } })
      fireEvent.click(submitButton)
      
      await waitFor(() => {
        expect(login).toHaveBeenCalledWith('test@example.com', 'password123')
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
      })
    })

    it('prevents default form submission', async () => {
      vi.mocked(login).mockResolvedValue(undefined)
      renderLogin()
      
      const form = screen.getByRole('form')
      const preventDefaultSpy = vi.fn()
      
      fireEvent.submit(form, { preventDefault: preventDefaultSpy } as any)
      
      expect(preventDefaultSpy).toHaveBeenCalled()
    })

    it('calls login with trimmed whitespace from inputs', async () => {
      vi.mocked(login).mockResolvedValue(undefined)
      renderLogin()
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      
      fireEvent.change(emailInput, { target: { value: '  test@example.com  ' } })
      fireEvent.change(passwordInput, { target: { value: '  password123  ' } })
      fireEvent.submit(screen.getByRole('form'))
      
      await waitFor(() => {
        expect(login).toHaveBeenCalledWith('  test@example.com  ', '  password123  ')
      })
    })
  })

  describe('Loading State', () => {
    it('shows loading state during login process', async () => {
      let resolveLogin: () => void
      const loginPromise = new Promise<void>((resolve) => {
        resolveLogin = resolve
      })
      vi.mocked(login).mockReturnValue(loginPromise)
      
      renderLogin()
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const submitButton = screen.getByRole('button')
      
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'password123' } })
      fireEvent.click(submitButton)
      
      expect(screen.getByText('Signing in...')).toBeInTheDocument()
      expect(submitButton).toBeDisabled()
      
      resolveLogin!()
      await waitFor(() => {
        expect(screen.getByText('Sign in')).toBeInTheDocument()
        expect(submitButton).not.toBeDisabled()
      })
    })

    it('disables button during loading', async () => {
      let resolveLogin: () => void
      const loginPromise = new Promise<void>((resolve) => {
        resolveLogin = resolve
      })
      vi.mocked(login).mockReturnValue(loginPromise)
      
      renderLogin()
      
      const submitButton = screen.getByRole('button')
      fireEvent.click(submitButton)
      
      expect(submitButton).toBeDisabled()
      
      resolveLogin!()
      await waitFor(() => {
        expect(submitButton).not.toBeDisabled()
      })
    })
  })

  describe('Error Handling - ApiError', () => {
    it('displays ApiError with status and details', async () => {
      const apiError = new ApiError(401, '/api/login', 'Invalid credentials')
      vi.mocked(login).mockRejectedValue(apiError)
      
      renderLogin()
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } })
      fireEvent.click(screen.getByRole('button'))
      
      await waitFor(() => {
        const errorElement = screen.getByText('Login failed (401) at /api/login. Response: Invalid credentials')
        expect(errorElement).toBeInTheDocument()
        expect(errorElement).toHaveClass('error')
        expect(errorElement.tagName).toBe('PRE')
      })
    })

    it('handles ApiError with different status codes', async () => {
      const testCases = [
        { status: 400, url: '/api/login', body: 'Bad Request' },
        { status: 500, url: '/api/auth', body: 'Internal Server Error' },
        { status: 403, url: '/api/login', body: 'Forbidden' }
      ]
      
      for (const { status, url, body } of testCases) {
        vi.clearAllMocks()
        const apiError = new ApiError(status, url, body)
        vi.mocked(login).mockRejectedValue(apiError)
        
        renderLogin()
        fireEvent.click(screen.getByRole('button'))
        
        await waitFor(() => {
          expect(screen.getByText(`Login failed (${status}) at ${url}. Response: ${body}`)).toBeInTheDocument()
        })
      }
    })
  })

  describe('Error Handling - Generic Errors', () => {
    it('displays generic error message for unknown errors', async () => {
      const genericError = new Error('Network connection failed')
      vi.mocked(login).mockRejectedValue(genericError)
      
      renderLogin()
      
      fireEvent.click(screen.getByRole('button'))
      
      await waitFor(() => {
        expect(screen.getByText('Network connection failed')).toBeInTheDocument()
      })
    })

    it('displays fallback error message for errors without message', async () => {
      vi.mocked(login).mockRejectedValue({})
      
      renderLogin()
      
      fireEvent.click(screen.getByRole('button'))
      
      await waitFor(() => {
        expect(screen.getByText('Failed to log in')).toBeInTheDocument()
      })
    })

    it('handles null/undefined error objects', async () => {
      vi.mocked(login).mockRejectedValue(null)
      
      renderLogin()
      
      fireEvent.click(screen.getByRole('button'))
      
      await waitFor(() => {
        expect(screen.getByText('Failed to log in')).toBeInTheDocument()
      })
    })

    it('handles string errors', async () => {
      vi.mocked(login).mockRejectedValue('Something went wrong')
      
      renderLogin()
      
      fireEvent.click(screen.getByRole('button'))
      
      await waitFor(() => {
        expect(screen.getByText('Failed to log in')).toBeInTheDocument()
      })
    })
  })

  describe('Error State Management', () => {
    it('clears previous error on new submission attempt', async () => {
      // First failed attempt
      vi.mocked(login).mockRejectedValueOnce(new Error('First error'))
      renderLogin()
      
      fireEvent.click(screen.getByRole('button'))
      
      await waitFor(() => {
        expect(screen.getByText('First error')).toBeInTheDocument()
      })
      
      // Second attempt should clear previous error
      vi.mocked(login).mockResolvedValueOnce(undefined)
      fireEvent.click(screen.getByRole('button'))
      
      await waitFor(() => {
        expect(screen.queryByText('First error')).not.toBeInTheDocument()
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
      })
    })

    it('does not show error initially', () => {
      renderLogin()
      
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(screen.queryByText(/error/i)).not.toBeInTheDocument()
    })

    it('preserves error styling with pre-wrap', async () => {
      const multilineError = new ApiError(400, '/api/login', 'Line 1\nLine 2\nLine 3')
      vi.mocked(login).mockRejectedValue(multilineError)
      
      renderLogin()
      fireEvent.click(screen.getByRole('button'))
      
      await waitFor(() => {
        const errorElement = screen.getByText('Login failed (400)')
        expect(errorElement).toHaveStyle({ whiteSpace: 'pre-wrap' })
      })
    })
  })

  describe('Form Integration', () => {
    it('submits form on Enter key press in email field', async () => {
      vi.mocked(login).mockResolvedValue(undefined)
      renderLogin()
      
      const emailInput = screen.getByLabelText(/email/i)
      fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
      fireEvent.keyPress(emailInput, { key: 'Enter', code: 'Enter', charCode: 13 })
      
      await waitFor(() => {
        expect(login).toHaveBeenCalled()
      })
    })

    it('submits form on Enter key press in password field', async () => {
      vi.mocked(login).mockResolvedValue(undefined)
      renderLogin()
      
      const passwordInput = screen.getByLabelText(/password/i)
      fireEvent.change(passwordInput, { target: { value: 'password123' } })
      fireEvent.keyPress(passwordInput, { key: 'Enter', code: 'Enter', charCode: 13 })
      
      await waitFor(() => {
        expect(login).toHaveBeenCalled()
      })
    })

    it('handles multiple rapid submissions gracefully', async () => {
      let resolveCount = 0
      const resolvers: Array<() => void> = []
      
      vi.mocked(login).mockImplementation(() => {
        return new Promise<void>((resolve) => {
          resolvers[resolveCount++] = resolve
        })
      })
      
      renderLogin()
      
      const submitButton = screen.getByRole('button')
      
      // Rapid fire clicks
      fireEvent.click(submitButton)
      fireEvent.click(submitButton)
      fireEvent.click(submitButton)
      
      // Should only call login once due to loading state
      expect(login).toHaveBeenCalledTimes(1)
      expect(submitButton).toBeDisabled()
      
      // Resolve first login
      resolvers[0]()
      
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
      })
    })
  })

  describe('Edge Cases', () => {
    it('handles very long email addresses', async () => {
      vi.mocked(login).mockResolvedValue(undefined)
      renderLogin()
      
      const longEmail = 'a'.repeat(100) + '@' + 'b'.repeat(100) + '.com'
      const emailInput = screen.getByLabelText(/email/i)
      
      fireEvent.change(emailInput, { target: { value: longEmail } })
      fireEvent.click(screen.getByRole('button'))
      
      await waitFor(() => {
        expect(login).toHaveBeenCalledWith(longEmail, '')
      })
    })

    it('handles very long passwords', async () => {
      vi.mocked(login).mockResolvedValue(undefined)
      renderLogin()
      
      const longPassword = 'P@ssw0rd\\!' + 'a'.repeat(1000)
      const passwordInput = screen.getByLabelText(/password/i)
      
      fireEvent.change(passwordInput, { target: { value: longPassword } })
      fireEvent.click(screen.getByRole('button'))
      
      await waitFor(() => {
        expect(login).toHaveBeenCalledWith('', longPassword)
      })
    })

    it('handles Unicode characters in inputs', async () => {
      vi.mocked(login).mockResolvedValue(undefined)
      renderLogin()
      
      const unicodeEmail = 'tëst@éxämplé.cöm'
      const unicodePassword = 'pāssw🔑rd'
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      
      fireEvent.change(emailInput, { target: { value: unicodeEmail } })
      fireEvent.change(passwordInput, { target: { value: unicodePassword } })
      fireEvent.click(screen.getByRole('button'))
      
      await waitFor(() => {
        expect(login).toHaveBeenCalledWith(unicodeEmail, unicodePassword)
      })
    })

    it('resets loading state even if navigation fails', async () => {
      vi.mocked(login).mockResolvedValue(undefined)
      mockNavigate.mockImplementation(() => {
        throw new Error('Navigation failed')
      })
      
      renderLogin()
      
      fireEvent.click(screen.getByRole('button'))
      
      await waitFor(() => {
        expect(screen.getByText('Sign in')).toBeInTheDocument()
        expect(screen.getByRole('button')).not.toBeDisabled()
      })
    })
  })

  describe('Accessibility', () => {
    it('associates labels with inputs correctly', () => {
      renderLogin()
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      
      expect(emailInput).toBeInTheDocument()
      expect(passwordInput).toBeInTheDocument()
    })

    it('provides accessible button text', () => {
      renderLogin()
      
      const button = screen.getByRole('button', { name: /sign in/i })
      expect(button).toBeInTheDocument()
    })

    it('updates button text accessibly during loading', async () => {
      let resolveLogin: () => void
      const loginPromise = new Promise<void>((resolve) => {
        resolveLogin = resolve
      })
      vi.mocked(login).mockReturnValue(loginPromise)
      
      renderLogin()
      
      fireEvent.click(screen.getByRole('button'))
      
      expect(screen.getByRole('button', { name: /signing in/i })).toBeInTheDocument()
      
      resolveLogin!()
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
      })
    })
  })
})