/**
 * Tests for Signup component
 * Testing framework: Jest
 * Testing libraries: @testing-library/react and @testing-library/jest-dom
 * Notes: Assumes Jest environment. If using a different runner, adapt mocks accordingly.
 */
import React from 'react'
import '@testing-library/jest-dom'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import Signup from './Signup'
import { register, login } from '../api'
import { ApiError } from '../api'

// Mock the API module used by the component
jest.mock('../api', () => ({
  register: jest.fn(),
  login: jest.fn(),
  ApiError: class ApiError extends Error {
    status: number
    url: string
    body: string
    constructor(status: number, url: string, body: string) {
      super(`API Error: ${status}`)
      this.name = 'ApiError'
      this.status = status
      this.url = url
      this.body = body
    }
  }
}))

// Mock react-router-dom's useNavigate, keep other exports real
const mockNavigate = jest.fn()
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate
}))

const renderSignup = () =>
  render(
    <BrowserRouter>
      <Signup />
    </BrowserRouter>
  )

describe('Signup component', () => {
  const mockRegister = register as jest.MockedFunction<typeof register>
  const mockLogin = login as jest.MockedFunction<typeof login>

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Rendering', () => {
    test('renders heading, description, inputs, and submit button', () => {
      renderSignup()

      expect(screen.getByRole('heading', { name: 'Create your account' })).toBeInTheDocument()
      expect(screen.getByText('Sign up to upload knowledge sources and build your RAG.')).toBeInTheDocument()
      expect(screen.getByLabelText('Email')).toBeInTheDocument()
      expect(screen.getByLabelText('Password')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument()
    })

    test('email input attributes and default value', () => {
      renderSignup()
      const email = screen.getByLabelText('Email') as HTMLInputElement
      expect(email).toHaveAttribute('type', 'email')
      expect(email).toHaveAttribute('required')
      expect(email.value).toBe('')
    })

    test('password input attributes and default value', () => {
      renderSignup()
      const password = screen.getByLabelText('Password') as HTMLInputElement
      expect(password).toHaveAttribute('type', 'password')
      expect(password).toHaveAttribute('required')
      expect(password.value).toBe('')
    })

    test('submit button initial state and class', () => {
      renderSignup()
      const submit = screen.getByRole('button', { name: 'Create account' })
      expect(submit).toBeEnabled()
      expect(submit).toHaveClass('btn')
    })

    test('form and container classes', () => {
      renderSignup()
      const emailInput = screen.getByLabelText('Email')
      const form = emailInput.closest('form')
      expect(form).toHaveClass('form')

      const container = screen.getByText('Create your account').closest('div')
      expect(container).toHaveClass('container')
      expect(container).toHaveClass('narrow')
    })
  })

  describe('Input handling', () => {
    test('updates email and password on change', () => {
      renderSignup()
      const email = screen.getByLabelText('Email') as HTMLInputElement
      const password = screen.getByLabelText('Password') as HTMLInputElement

      fireEvent.change(email, { target: { value: 'test@example.com' } })
      fireEvent.change(password, { target: { value: 'password123' } })

      expect(email.value).toBe('test@example.com')
      expect(password.value).toBe('password123')
    })

    test('accepts special characters and unicode', () => {
      renderSignup()
      const email = screen.getByLabelText('Email') as HTMLInputElement
      const password = screen.getByLabelText('Password') as HTMLInputElement

      fireEvent.change(email, { target: { value: 'тест+tag@example.co.uk' } })
      fireEvent.change(password, { target: { value: 'P@ssw0rd_日本語' } })

      expect(email.value).toBe('тест+tag@example.co.uk')
      expect(password.value).toBe('P@ssw0rd_日本語')
    })
  })

  describe('Submission success', () => {
    test('calls register then login and navigates to dashboard', async () => {
      mockRegister.mockResolvedValueOnce(undefined)
      mockLogin.mockResolvedValueOnce(undefined)

      renderSignup()
      fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
      fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
      fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

      // Loading state while awaiting
      expect(screen.getByRole('button', { name: 'Creating...' })).toBeDisabled()

      await waitFor(() => {
        expect(mockRegister).toHaveBeenCalledWith('test@example.com', 'password123')
        expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123')
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
      })

      // Back to idle state
      expect(screen.getByRole('button', { name: 'Create account' })).toBeEnabled()
    })

    test('clears previous error before retry', async () => {
      mockRegister.mockRejectedValueOnce(new Error('First error'))
      mockRegister.mockResolvedValueOnce(undefined)
      mockLogin.mockResolvedValueOnce(undefined)

      renderSignup()
      fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.c' } })
      fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'x' } })

      const submit = screen.getByRole('button')
      fireEvent.click(submit)

      await waitFor(() => expect(screen.getByText('First error')).toBeInTheDocument())

      fireEvent.click(submit)

      await waitFor(() => expect(screen.queryByText('First error')).not.toBeInTheDocument())
      await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/dashboard'))
    })
  })

  describe('Error handling', () => {
    test('shows detailed message for ApiError during register', async () => {
      const err = new ApiError(400, '/api/register', 'Email already exists')
      mockRegister.mockRejectedValueOnce(err)

      renderSignup()
      fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
      fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
      fireEvent.click(screen.getByRole('button'))

      await waitFor(() =>
        expect(screen.getByText('Signup failed (400) at /api/register. Response: Email already exists')).toBeInTheDocument()
      )
      expect(mockLogin).not.toHaveBeenCalled()
      expect(mockNavigate).not.toHaveBeenCalled()
      expect(screen.getByRole('button', { name: 'Create account' })).toBeEnabled()
    })

    test('shows detailed message for ApiError during login', async () => {
      mockRegister.mockResolvedValueOnce(undefined)
      const err = new ApiError(401, '/api/login', 'Invalid credentials')
      mockLogin.mockRejectedValueOnce(err)

      renderSignup()
      fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@example.com' } })
      fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
      fireEvent.click(screen.getByRole('button'))

      await waitFor(() =>
        expect(screen.getByText('Signup failed (401) at /api/login. Response: Invalid credentials')).toBeInTheDocument()
      )
      expect(mockRegister).toHaveBeenCalled()
      expect(mockNavigate).not.toHaveBeenCalled()
    })

    test('falls back to generic message when error has no message', async () => {
      // no message
      mockRegister.mockRejectedValueOnce({})
      renderSignup()
      fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'x@y.z' } })
      fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'pwd' } })
      fireEvent.click(screen.getByRole('button'))

      await waitFor(() => expect(screen.getByText('Failed to sign up')).toBeInTheDocument())
    })

    test('handles null/undefined thrown errors gracefully', async () => {
      mockRegister.mockRejectedValueOnce(null as any)
      renderSignup()
      fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'x@y.z' } })
      fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'pwd' } })
      fireEvent.click(screen.getByRole('button'))

      await waitFor(() => expect(screen.getByText('Failed to sign up')).toBeInTheDocument())
    })

    test('error message element has correct styling', async () => {
      mockRegister.mockRejectedValueOnce(new Error('Styled error'))
      renderSignup()
      fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'x@y.z' } })
      fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'pwd' } })
      fireEvent.click(screen.getByRole('button'))

      await waitFor(() => {
        const el = screen.getByText('Styled error')
        expect(el).toHaveClass('error')
        expect(el.tagName).toBe('PRE')
        expect(el).toHaveStyle({ whiteSpace: 'pre-wrap' })
      })
    })
  })

  describe('Loading state', () => {
    test('disables submit and shows "Creating..." while awaiting', async () => {
      let resolveRegister!: () => void
      const pending = new Promise<void>((resolve) => (resolveRegister = resolve))
      mockRegister.mockReturnValueOnce(pending as any)

      renderSignup()
      fireEvent.change(screen.getByLabelText('Email'), { target: { value: 't@e.st' } })
      fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'pwd' } })
      fireEvent.click(screen.getByRole('button'))

      expect(screen.getByRole('button', { name: 'Creating...' })).toBeDisabled()

      resolveRegister()
      mockLogin.mockResolvedValueOnce(undefined)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Create account' })).toBeEnabled()
      })
    })

    test('returns to idle state after error', async () => {
      mockRegister.mockRejectedValueOnce(new Error('Oops'))
      renderSignup()
      fireEvent.change(screen.getByLabelText('Email'), { target: { value: 't@e.st' } })
      fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'pwd' } })
      fireEvent.click(screen.getByRole('button'))

      await waitFor(() => {
        expect(screen.getByText('Oops')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Create account' })).toBeEnabled()
      })
    })
  })

  describe('Edge cases', () => {
    test('multiple rapid clicks only trigger one submission due to loading lock', async () => {
      let resolveRegister!: () => void
      const pending = new Promise<void>((resolve) => (resolveRegister = resolve))
      mockRegister.mockReturnValueOnce(pending as any)

      renderSignup()
      fireEvent.change(screen.getByLabelText('Email'), { target: { value: 't@e.st' } })
      fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'pwd' } })

      const button = screen.getByRole('button')
      fireEvent.click(button)
      fireEvent.click(button)
      fireEvent.click(button)

      expect(button).toBeDisabled()
      expect(mockRegister).toHaveBeenCalledTimes(1)

      resolveRegister()
      mockLogin.mockResolvedValueOnce(undefined)
      await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/dashboard'))
    })

    test('submits with whitespace-only inputs (component does not trim)', async () => {
      mockRegister.mockResolvedValueOnce(undefined)
      mockLogin.mockResolvedValueOnce(undefined)

      renderSignup()
      fireEvent.change(screen.getByLabelText('Email'), { target: { value: '   ' } })
      fireEvent.change(screen.getByLabelText('Password'), { target: { value: '   ' } })
      fireEvent.click(screen.getByRole('button'))

      await waitFor(() => {
        expect(mockRegister).toHaveBeenCalledWith('   ', '   ')
      })
    })

    test('handles very long input values', async () => {
      mockRegister.mockResolvedValueOnce(undefined)
      mockLogin.mockResolvedValueOnce(undefined)

      const longEmail = 'a'.repeat(200) + '@example.com'
      const longPassword = 'p'.repeat(500)

      renderSignup()
      fireEvent.change(screen.getByLabelText('Email'), { target: { value: longEmail } })
      fireEvent.change(screen.getByLabelText('Password'), { target: { value: longPassword } })
      fireEvent.click(screen.getByRole('button'))

      await waitFor(() => {
        expect(mockRegister).toHaveBeenCalledWith(longEmail, longPassword)
      })
    })

    test('labels are properly associated and expose accessible names', () => {
      renderSignup()
      const email = screen.getByLabelText('Email')
      const password = screen.getByLabelText('Password')
      expect(email).toBeInTheDocument()
      expect(password).toBeInTheDocument()
    })
  })
})