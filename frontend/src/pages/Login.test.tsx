import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import Login from './Login'
import { login } from '../api'
import { ApiError } from '../api'

// Mock the API module
jest.mock('../api', () => ({
  login: jest.fn(),
  ApiError: jest.fn().mockImplementation((status, url, body) => {
    const error = new Error(`API Error: ${status}`)
    error.status = status
    error.url = url
    error.body = body
    return error
  })
}))

// Mock useNavigate
const mockNavigate = jest.fn()
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate
}))

// Helper function to render Login with router context
const renderLogin = () => {
  return render(
    <BrowserRouter>
      <Login />
    </BrowserRouter>
  )
}

describe('Login Component', () => {
  const mockedLogin = login as jest.MockedFunction<typeof login>
  
  beforeEach(() => {
    jest.clearAllMocks()
    mockNavigate.mockClear()
  })

  describe('Initial Render', () => {
    test('renders login form with all required elements', () => {
      renderLogin()
      
      expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument()
      expect(screen.getByRole('form')).toBeInTheDocument()
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
    })

    test('has correct input types and attributes', () => {
      renderLogin()
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      
      expect(emailInput).toHaveAttribute('type', 'email')
      expect(emailInput).toHaveAttribute('required')
      expect(passwordInput).toHaveAttribute('type', 'password')
      expect(passwordInput).toHaveAttribute('required')
    })

    test('submit button is initially enabled', () => {
      renderLogin()
      
      const submitButton = screen.getByRole('button', { name: /sign in/i })
      expect(submitButton).not.toBeDisabled()
    })

    test('does not show error message initially', () => {
      renderLogin()
      
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(screen.queryByText(/login failed/i)).not.toBeInTheDocument()
    })
  })

  describe('Form Input Handling', () => {
    test('updates email input value when user types', async () => {
      const user = userEvent.setup()
      renderLogin()
      
      const emailInput = screen.getByLabelText(/email/i)
      await user.type(emailInput, 'test@example.com')
      
      expect(emailInput).toHaveValue('test@example.com')
    })

    test('updates password input value when user types', async () => {
      const user = userEvent.setup()
      renderLogin()
      
      const passwordInput = screen.getByLabelText(/password/i)
      await user.type(passwordInput, 'password123')
      
      expect(passwordInput).toHaveValue('password123')
    })

    test('handles empty inputs', async () => {
      const user = userEvent.setup()
      renderLogin()
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      
      await user.type(emailInput, 'test')
      await user.clear(emailInput)
      await user.type(passwordInput, 'pass')
      await user.clear(passwordInput)
      
      expect(emailInput).toHaveValue('')
      expect(passwordInput).toHaveValue('')
    })

    test('handles special characters in inputs', async () => {
      const user = userEvent.setup()
      renderLogin()
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      
      await user.type(emailInput, 'user+test@example-domain.co.uk')
      await user.type(passwordInput, 'P@ssw0rd\\!#$%')
      
      expect(emailInput).toHaveValue('user+test@example-domain.co.uk')
      expect(passwordInput).toHaveValue('P@ssw0rd\\!#$%')
    })
  })

  describe('Form Submission - Success Cases', () => {
    test('successfully logs in and navigates to dashboard', async () => {
      const user = userEvent.setup()
      mockedLogin.mockResolvedValueOnce(undefined)
      
      renderLogin()
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const submitButton = screen.getByRole('button', { name: /sign in/i })
      
      await user.type(emailInput, 'test@example.com')
      await user.type(passwordInput, 'password123')
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(mockedLogin).toHaveBeenCalledWith('test@example.com', 'password123')
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
      })
    })

    test('shows loading state during login', async () => {
      const user = userEvent.setup()
      let resolveLogin: () => void
      const loginPromise = new Promise<void>((resolve) => {
        resolveLogin = resolve
      })
      mockedLogin.mockReturnValueOnce(loginPromise)
      
      renderLogin()
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const submitButton = screen.getByRole('button', { name: /sign in/i })
      
      await user.type(emailInput, 'test@example.com')
      await user.type(passwordInput, 'password123')
      await user.click(submitButton)
      
      expect(screen.getByRole('button', { name: /signing in/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled()
      
      resolveLogin()
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /sign in/i })).not.toBeDisabled()
      })
    })

    test('clears error message on successful retry', async () => {
      const user = userEvent.setup()
      renderLogin()
      
      // First, cause an error
      mockedLogin.mockRejectedValueOnce(new Error('Network error'))
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const submitButton = screen.getByRole('button', { name: /sign in/i })
      
      await user.type(emailInput, 'test@example.com')
      await user.type(passwordInput, 'password123')
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(screen.getByText(/failed to log in/i)).toBeInTheDocument()
      })
      
      // Then succeed
      mockedLogin.mockResolvedValueOnce(undefined)
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(screen.queryByText(/failed to log in/i)).not.toBeInTheDocument()
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
      })
    })
  })

  describe('Form Submission - Error Cases', () => {
    test('handles ApiError with full details', async () => {
      const user = userEvent.setup()
      const apiError = new ApiError(401, 'https://api.example.com/login', 'Invalid credentials')
      mockedLogin.mockRejectedValueOnce(apiError)
      
      renderLogin()
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const submitButton = screen.getByRole('button', { name: /sign in/i })
      
      await user.type(emailInput, 'test@example.com')
      await user.type(passwordInput, 'wrongpassword')
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(screen.getByText(/login failed \(401\) at https:\/\/api\.example\.com\/login\. response: invalid credentials/i)).toBeInTheDocument()
      })
      
      expect(mockNavigate).not.toHaveBeenCalled()
    })

    test('handles generic Error with message', async () => {
      const user = userEvent.setup()
      const genericError = new Error('Network connection failed')
      mockedLogin.mockRejectedValueOnce(genericError)
      
      renderLogin()
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const submitButton = screen.getByRole('button', { name: /sign in/i })
      
      await user.type(emailInput, 'test@example.com')
      await user.type(passwordInput, 'password123')
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(screen.getByText(/network connection failed/i)).toBeInTheDocument()
      })
      
      expect(mockNavigate).not.toHaveBeenCalled()
    })

    test('handles error without message', async () => {
      const user = userEvent.setup()
      const errorWithoutMessage = {}
      mockedLogin.mockRejectedValueOnce(errorWithoutMessage)
      
      renderLogin()
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const submitButton = screen.getByRole('button', { name: /sign in/i })
      
      await user.type(emailInput, 'test@example.com')
      await user.type(passwordInput, 'password123')
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(screen.getByText(/failed to log in/i)).toBeInTheDocument()
      })
      
      expect(mockNavigate).not.toHaveBeenCalled()
    })

    test('handles null error', async () => {
      const user = userEvent.setup()
      mockedLogin.mockRejectedValueOnce(null)
      
      renderLogin()
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const submitButton = screen.getByRole('button', { name: /sign in/i })
      
      await user.type(emailInput, 'test@example.com')
      await user.type(passwordInput, 'password123')
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(screen.getByText(/failed to log in/i)).toBeInTheDocument()
      })
      
      expect(mockNavigate).not.toHaveBeenCalled()
    })

    test('resets loading state after error', async () => {
      const user = userEvent.setup()
      mockedLogin.mockRejectedValueOnce(new Error('Server error'))
      
      renderLogin()
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const submitButton = screen.getByRole('button', { name: /sign in/i })
      
      await user.type(emailInput, 'test@example.com')
      await user.type(passwordInput, 'password123')
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(screen.getByText(/server error/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /sign in/i })).not.toBeDisabled()
      })
    })
  })

  describe('Form Validation and Edge Cases', () => {
    test('prevents form submission with preventDefault', async () => {
      const user = userEvent.setup()
      const preventDefaultSpy = jest.fn()
      
      renderLogin()
      
      const form = screen.getByRole('form')
      
      // Override the form's onSubmit to spy on preventDefault
      const originalSubmit = form.onsubmit
      form.onsubmit = (e) => {
        preventDefaultSpy(e)
        return originalSubmit?.call(form, e)
      }
      
      const submitButton = screen.getByRole('button', { name: /sign in/i })
      await user.click(submitButton)
      
      expect(preventDefaultSpy).toHaveBeenCalled()
    })

    test('handles form submission with empty fields', async () => {
      const user = userEvent.setup()
      renderLogin()
      
      const submitButton = screen.getByRole('button', { name: /sign in/i })
      await user.click(submitButton)
      
      // Since fields are required, browser validation should prevent submission
      // But if it somehow gets through, our component should handle empty strings
      expect(mockedLogin).not.toHaveBeenCalled()
    })

    test('handles very long input values', async () => {
      const user = userEvent.setup()
      const longEmail = 'a'.repeat(100) + '@example.com'
      const longPassword = 'p'.repeat(200)
      
      mockedLogin.mockResolvedValueOnce(undefined)
      
      renderLogin()
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const submitButton = screen.getByRole('button', { name: /sign in/i })
      
      await user.type(emailInput, longEmail)
      await user.type(passwordInput, longPassword)
      await user.click(submitButton)
      
      await waitFor(() => {
        expect(mockedLogin).toHaveBeenCalledWith(longEmail, longPassword)
      })
    })

    test('handles rapid multiple submissions', async () => {
      const user = userEvent.setup()
      let resolveLogin: () => void
      const loginPromise = new Promise<void>((resolve) => {
        resolveLogin = resolve
      })
      mockedLogin.mockReturnValueOnce(loginPromise)
      
      renderLogin()
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const submitButton = screen.getByRole('button', { name: /sign in/i })
      
      await user.type(emailInput, 'test@example.com')
      await user.type(passwordInput, 'password123')
      
      // Click multiple times rapidly
      await user.click(submitButton)
      await user.click(submitButton)
      await user.click(submitButton)
      
      // Should only call login once and button should be disabled
      expect(mockedLogin).toHaveBeenCalledTimes(1)
      expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled()
      
      resolveLogin()
    })
  })

  describe('Error Message Display', () => {
    test('error message has correct styling and attributes', async () => {
      const user = userEvent.setup()
      mockedLogin.mockRejectedValueOnce(new Error('Test error'))
      
      renderLogin()
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const submitButton = screen.getByRole('button', { name: /sign in/i })
      
      await user.type(emailInput, 'test@example.com')
      await user.type(passwordInput, 'password123')
      await user.click(submitButton)
      
      await waitFor(() => {
        const errorElement = screen.getByText(/test error/i)
        expect(errorElement).toBeInTheDocument()
        expect(errorElement.tagName).toBe('PRE')
        expect(errorElement).toHaveClass('error')
        expect(errorElement).toHaveStyle({ whiteSpace: 'pre-wrap' })
      })
    })

    test('error message preserves formatting for multiline content', async () => {
      const user = userEvent.setup()
      const multilineError = 'Line 1\nLine 2\nLine 3'
      mockedLogin.mockRejectedValueOnce(new Error(multilineError))
      
      renderLogin()
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const submitButton = screen.getByRole('button', { name: /sign in/i })
      
      await user.type(emailInput, 'test@example.com')
      await user.type(passwordInput, 'password123')
      await user.click(submitButton)
      
      await waitFor(() => {
        const errorElement = screen.getByText(multilineError)
        expect(errorElement).toBeInTheDocument()
        expect(errorElement).toHaveStyle({ whiteSpace: 'pre-wrap' })
      })
    })
  })

  describe('Component Accessibility', () => {
    test('form has proper accessibility structure', () => {
      renderLogin()
      
      const form = screen.getByRole('form')
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const submitButton = screen.getByRole('button', { name: /sign in/i })
      
      expect(form).toBeInTheDocument()
      expect(emailInput).toBeAccessible()
      expect(passwordInput).toBeAccessible()
      expect(submitButton).toBeAccessible()
    })

    test('labels are properly associated with inputs', () => {
      renderLogin()
      
      const emailInput = screen.getByLabelText(/email/i)
      const passwordInput = screen.getByLabelText(/password/i)
      
      expect(emailInput).toHaveAccessibleName('Email')
      expect(passwordInput).toHaveAccessibleName('Password')
    })
  })

  describe('Integration with Router', () => {
    test('component renders without router context error', () => {
      // This test ensures the component can handle router context properly
      expect(() => renderLogin()).not.toThrow()
    })
  })
})