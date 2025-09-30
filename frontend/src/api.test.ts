import { ApiError, setToken, getToken, setEmail, getEmail, logout, api, register, login, listFiles, uploadFiles, buildRag, assess } from './api';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock FormData
global.FormData = jest.fn().mockImplementation(() => ({
  append: jest.fn(),
}));

describe('ApiError', () => {
  test('should create ApiError with correct properties', () => {
    const error = new ApiError('Test error', 404, '/api/test', 'Not found');
    
    expect(error.message).toBe('Test error');
    expect(error.name).toBe('ApiError');
    expect(error.status).toBe(404);
    expect(error.url).toBe('/api/test');
    expect(error.body).toBe('Not found');
    expect(error).toBeInstanceOf(Error);
  });

  test('should handle empty body', () => {
    const error = new ApiError('Test error', 500, '/api/test', '');
    
    expect(error.body).toBe('');
  });

  test('should inherit from Error class', () => {
    const error = new ApiError('Test error', 400, '/api/test', 'Bad request');
    
    expect(error instanceof Error).toBe(true);
    expect(error instanceof ApiError).toBe(true);
  });
});

describe('Token Management', () => {
  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
  });

  describe('setToken', () => {
    test('should store token in localStorage when token is provided', () => {
      setToken('test-token');
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith('auth_token', 'test-token');
    });

    test('should remove token from localStorage when token is null', () => {
      setToken(null);
      
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth_token');
    });

    test('should remove token from localStorage when token is empty string', () => {
      setToken('');
      
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth_token');
    });

    test('should handle undefined token as null', () => {
      setToken(undefined as any);
      
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth_token');
    });
  });

  describe('getToken', () => {
    test('should return token from localStorage', () => {
      localStorageMock.getItem.mockReturnValue('stored-token');
      
      const token = getToken();
      
      expect(token).toBe('stored-token');
      expect(localStorageMock.getItem).toHaveBeenCalledWith('auth_token');
    });

    test('should return null when no token is stored', () => {
      localStorageMock.getItem.mockReturnValue(null);
      
      const token = getToken();
      
      expect(token).toBeNull();
    });
  });
});

describe('Email Management', () => {
  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
  });

  describe('setEmail', () => {
    test('should store email in localStorage when email is provided', () => {
      setEmail('test@example.com');
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith('auth_email', 'test@example.com');
    });

    test('should remove email from localStorage when email is null', () => {
      setEmail(null);
      
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth_email');
    });

    test('should handle empty email string', () => {
      setEmail('');
      
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth_email');
    });

    test('should handle complex email formats', () => {
      const complexEmail = 'user+tag@sub.domain.com';
      setEmail(complexEmail);
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith('auth_email', complexEmail);
    });
  });

  describe('getEmail', () => {
    test('should return email from localStorage', () => {
      localStorageMock.getItem.mockReturnValue('stored@example.com');
      
      const email = getEmail();
      
      expect(email).toBe('stored@example.com');
      expect(localStorageMock.getItem).toHaveBeenCalledWith('auth_email');
    });

    test('should return null when no email is stored', () => {
      localStorageMock.getItem.mockReturnValue(null);
      
      const email = getEmail();
      
      expect(email).toBeNull();
    });
  });
});

describe('logout', () => {
  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
  });

  test('should clear both token and email', () => {
    logout();
    
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth_token');
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth_email');
    expect(localStorageMock.removeItem).toHaveBeenCalledTimes(2);
  });

  test('should work even when no data is stored', () => {
    logout();
    
    expect(localStorageMock.removeItem).toHaveBeenCalledTimes(2);
  });
});

describe('api function', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    localStorageMock.clear();
    jest.clearAllMocks();
  });

  test('should make successful API call without token', async () => {
    const mockResponse = { success: true };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: jest.fn().mockResolvedValueOnce(JSON.stringify(mockResponse)),
    });
    localStorageMock.getItem.mockReturnValue(null);

    const result = await api('/api/test');

    expect(mockFetch).toHaveBeenCalledWith('/api/test', {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    expect(result).toEqual(mockResponse);
  });

  test('should include Authorization header when token exists', async () => {
    const mockResponse = { success: true };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: jest.fn().mockResolvedValueOnce(JSON.stringify(mockResponse)),
    });
    localStorageMock.getItem.mockReturnValue('test-token');

    await api('/api/test');

    expect(mockFetch).toHaveBeenCalledWith('/api/test', {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test-token',
      },
    });
  });

  test('should merge custom headers with default headers', async () => {
    const mockResponse = { success: true };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: jest.fn().mockResolvedValueOnce(JSON.stringify(mockResponse)),
    });
    localStorageMock.getItem.mockReturnValue('test-token');

    await api('/api/test', {
      headers: {
        'Custom-Header': 'custom-value',
        'Content-Type': 'application/xml', // Should override default
      },
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/test', {
      headers: {
        'Content-Type': 'application/xml',
        'Custom-Header': 'custom-value',
        'Authorization': 'Bearer test-token',
      },
    });
  });

  test('should handle empty response text', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: jest.fn().mockResolvedValueOnce(''),
    });
    localStorageMock.getItem.mockReturnValue(null);

    const result = await api('/api/test');

    expect(result).toEqual({});
  });

  test('should handle non-JSON response gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: jest.fn().mockResolvedValueOnce('plain text response'),
    });
    localStorageMock.getItem.mockReturnValue(null);

    const result = await api('/api/test');

    expect(result).toEqual({});
  });

  test('should throw ApiError on failed request', async () => {
    const errorText = 'Not found';
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: jest.fn().mockResolvedValueOnce(errorText),
    });
    localStorageMock.getItem.mockReturnValue(null);

    await expect(api('/api/test')).rejects.toThrow(ApiError);
    
    try {
      await api('/api/test');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(404);
      expect((error as ApiError).url).toBe('/api/test');
      expect((error as ApiError).body).toBe(errorText);
      expect((error as ApiError).message).toBe('Request failed (404)');
    }
  });

  test('should handle error with empty response body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: jest.fn().mockResolvedValueOnce(''),
    });

    try {
      await api('/api/test');
    } catch (error) {
      expect((error as ApiError).body).toBe('');
    }
  });

  test('should pass through request options', async () => {
    const mockResponse = { success: true };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: jest.fn().mockResolvedValueOnce(JSON.stringify(mockResponse)),
    });
    localStorageMock.getItem.mockReturnValue(null);

    await api('/api/test', {
      method: 'POST',
      body: JSON.stringify({ data: 'test' }),
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/test', {
      method: 'POST',
      body: JSON.stringify({ data: 'test' }),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  });
});

describe('register function', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    jest.clearAllMocks();
  });

  test('should call api with correct registration parameters', async () => {
    const mockResponse = { success: true, user_id: 123 };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: jest.fn().mockResolvedValueOnce(JSON.stringify(mockResponse)),
    });

    const result = await register('test@example.com', 'password123');

    expect(mockFetch).toHaveBeenCalledWith('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com', password: 'password123' }),
      headers: {
        'Content-Type': 'application/json',
      },
    });
    expect(result).toEqual(mockResponse);
  });

  test('should handle registration failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: jest.fn().mockResolvedValueOnce('Email already exists'),
    });

    await expect(register('test@example.com', 'password123')).rejects.toThrow(ApiError);
  });

  test('should handle special characters in email and password', async () => {
    const mockResponse = { success: true };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: jest.fn().mockResolvedValueOnce(JSON.stringify(mockResponse)),
    });

    const email = 'user+tag@domain.co.uk';
    const password = 'p@ssw0rd\!@#$%';
    
    await register(email, password);

    expect(mockFetch).toHaveBeenCalledWith('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  });
});

describe('login function', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    localStorageMock.clear();
    jest.clearAllMocks();
  });

  test('should call api with correct login parameters and store token and email', async () => {
    const mockResponse = { access_token: 'login-token', user: { id: 1 } };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: jest.fn().mockResolvedValueOnce(JSON.stringify(mockResponse)),
    });

    const result = await login('test@example.com', 'password123');

    expect(mockFetch).toHaveBeenCalledWith('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com', password: 'password123' }),
      headers: {
        'Content-Type': 'application/json',
      },
    });
    expect(localStorageMock.setItem).toHaveBeenCalledWith('auth_token', 'login-token');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('auth_email', 'test@example.com');
    expect(result).toEqual(mockResponse);
  });

  test('should not store token when access_token is not provided', async () => {
    const mockResponse = { message: 'Login successful' };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: jest.fn().mockResolvedValueOnce(JSON.stringify(mockResponse)),
    });

    await login('test@example.com', 'password123');

    expect(localStorageMock.setItem).not.toHaveBeenCalledWith('auth_token', expect.anything());
    expect(localStorageMock.setItem).toHaveBeenCalledWith('auth_email', 'test@example.com');
  });

  test('should handle login failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: jest.fn().mockResolvedValueOnce('Invalid credentials'),
    });

    await expect(login('test@example.com', 'wrongpassword')).rejects.toThrow(ApiError);
    expect(localStorageMock.setItem).not.toHaveBeenCalled();
  });

  test('should store email even when access_token is falsy', async () => {
    const mockResponse = { access_token: null, message: 'Partial login' };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: jest.fn().mockResolvedValueOnce(JSON.stringify(mockResponse)),
    });

    await login('test@example.com', 'password123');

    expect(localStorageMock.setItem).not.toHaveBeenCalledWith('auth_token', expect.anything());
    expect(localStorageMock.setItem).toHaveBeenCalledWith('auth_email', 'test@example.com');
  });

  test('should handle empty email gracefully', async () => {
    const mockResponse = { access_token: 'token123' };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: jest.fn().mockResolvedValueOnce(JSON.stringify(mockResponse)),
    });

    await login('', 'password123');

    expect(localStorageMock.setItem).toHaveBeenCalledWith('auth_token', 'token123');
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth_email');
  });
});

describe('listFiles function', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    jest.clearAllMocks();
  });

  test('should call api with correct endpoint', async () => {
    const mockResponse = { files: ['file1.txt', 'file2.pdf'] };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: jest.fn().mockResolvedValueOnce(JSON.stringify(mockResponse)),
    });

    const result = await listFiles();

    expect(mockFetch).toHaveBeenCalledWith('/api/files', {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    expect(result).toEqual(mockResponse);
  });

  test('should handle empty file list', async () => {
    const mockResponse = { files: [] };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: jest.fn().mockResolvedValueOnce(JSON.stringify(mockResponse)),
    });

    const result = await listFiles();

    expect(result).toEqual(mockResponse);
  });
});

describe('uploadFiles function', () => {
  let mockFormDataInstance: any;

  beforeEach(() => {
    mockFetch.mockClear();
    localStorageMock.clear();
    jest.clearAllMocks();
    
    mockFormDataInstance = {
      append: jest.fn(),
    };
    (FormData as jest.Mock).mockImplementation(() => mockFormDataInstance);
  });

  test('should upload files with token', async () => {
    const mockResponse = { uploaded: ['file1.txt', 'file2.pdf'] };
    const mockFiles = [
      new File(['content1'], 'file1.txt', { type: 'text/plain' }),
      new File(['content2'], 'file2.pdf', { type: 'application/pdf' }),
    ];
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce(mockResponse),
    });
    localStorageMock.getItem.mockReturnValue('upload-token');

    const result = await uploadFiles(mockFiles);

    expect(FormData).toHaveBeenCalled();
    expect(mockFormDataInstance.append).toHaveBeenCalledWith('files', mockFiles[0], 'file1.txt');
    expect(mockFormDataInstance.append).toHaveBeenCalledWith('files', mockFiles[1], 'file2.pdf');
    expect(mockFetch).toHaveBeenCalledWith('/api/files/upload', {
      method: 'POST',
      headers: { Authorization: 'Bearer upload-token' },
      body: mockFormDataInstance,
    });
    expect(result).toEqual(mockResponse);
  });

  test('should upload files without token', async () => {
    const mockResponse = { uploaded: ['file1.txt'] };
    const mockFiles = [new File(['content'], 'file1.txt', { type: 'text/plain' })];
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce(mockResponse),
    });
    localStorageMock.getItem.mockReturnValue(null);

    const result = await uploadFiles(mockFiles);

    expect(mockFetch).toHaveBeenCalledWith('/api/files/upload', {
      method: 'POST',
      headers: undefined,
      body: mockFormDataInstance,
    });
    expect(result).toEqual(mockResponse);
  });

  test('should handle upload failure', async () => {
    const mockFiles = [new File(['content'], 'file1.txt', { type: 'text/plain' })];
    const errorText = 'Upload failed';
    
    mockFetch.mockResolvedValueOnce({
      ok: false,
      text: jest.fn().mockResolvedValueOnce(errorText),
    });

    await expect(uploadFiles(mockFiles)).rejects.toThrow(errorText);
  });

  test('should handle empty file array', async () => {
    const mockResponse = { uploaded: [] };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce(mockResponse),
    });

    const result = await uploadFiles([]);

    expect(mockFormDataInstance.append).not.toHaveBeenCalled();
    expect(result).toEqual(mockResponse);
  });

  test('should handle files with special characters in names', async () => {
    const mockResponse = { uploaded: ['file with spaces & symbols\!.txt'] };
    const mockFiles = [new File(['content'], 'file with spaces & symbols\!.txt', { type: 'text/plain' })];
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce(mockResponse),
    });

    await uploadFiles(mockFiles);

    expect(mockFormDataInstance.append).toHaveBeenCalledWith('files', mockFiles[0], 'file with spaces & symbols\!.txt');
  });
});

describe('buildRag function', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    jest.clearAllMocks();
  });

  test('should call api with correct build endpoint', async () => {
    const mockResponse = { status: 'building', build_id: 'build_123' };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: jest.fn().mockResolvedValueOnce(JSON.stringify(mockResponse)),
    });

    const result = await buildRag();

    expect(mockFetch).toHaveBeenCalledWith('/api/rag/build', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    expect(result).toEqual(mockResponse);
  });

  test('should handle build failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: jest.fn().mockResolvedValueOnce('Build failed'),
    });

    await expect(buildRag()).rejects.toThrow(ApiError);
  });
});

describe('assess function', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    jest.clearAllMocks();
  });

  test('should call api with correct assess parameters', async () => {
    const mockResponse = { assessment: 'positive', score: 0.8 };
    const testText = 'This is a test text for assessment';
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: jest.fn().mockResolvedValueOnce(JSON.stringify(mockResponse)),
    });

    const result = await assess(testText);

    expect(mockFetch).toHaveBeenCalledWith('/api/rag/assess', {
      method: 'POST',
      body: JSON.stringify({ text: testText }),
      headers: {
        'Content-Type': 'application/json',
      },
    });
    expect(result).toEqual(mockResponse);
  });

  test('should handle empty text', async () => {
    const mockResponse = { assessment: 'neutral', score: 0.0 };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: jest.fn().mockResolvedValueOnce(JSON.stringify(mockResponse)),
    });

    const result = await assess('');

    expect(mockFetch).toHaveBeenCalledWith('/api/rag/assess', {
      method: 'POST',
      body: JSON.stringify({ text: '' }),
      headers: {
        'Content-Type': 'application/json',
      },
    });
    expect(result).toEqual(mockResponse);
  });

  test('should handle large text input', async () => {
    const mockResponse = { assessment: 'complex', score: 0.6 };
    const largeText = 'Lorem ipsum '.repeat(1000);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: jest.fn().mockResolvedValueOnce(JSON.stringify(mockResponse)),
    });

    await assess(largeText);

    expect(mockFetch).toHaveBeenCalledWith('/api/rag/assess', {
      method: 'POST',
      body: JSON.stringify({ text: largeText }),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  });

  test('should handle special characters in text', async () => {
    const mockResponse = { assessment: 'special', score: 0.7 };
    const specialText = 'Text with émojis 🚀 and speciál châractérs\!@#$%^&*()';
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: jest.fn().mockResolvedValueOnce(JSON.stringify(mockResponse)),
    });

    await assess(specialText);

    expect(mockFetch).toHaveBeenCalledWith('/api/rag/assess', {
      method: 'POST',
      body: JSON.stringify({ text: specialText }),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  });

  test('should handle assessment failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: jest.fn().mockResolvedValueOnce('Invalid text format'),
    });

    await expect(assess('test text')).rejects.toThrow(ApiError);
  });
});

describe('Integration Tests', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    localStorageMock.clear();
    jest.clearAllMocks();
  });

  test('should handle complete login and API call workflow', async () => {
    // Mock login response
    const loginResponse = { access_token: 'workflow-token', user: { id: 1 } };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: jest.fn().mockResolvedValueOnce(JSON.stringify(loginResponse)),
    });

    // Mock files list response
    const filesResponse = { files: ['file1.txt', 'file2.pdf'] };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: jest.fn().mockResolvedValueOnce(JSON.stringify(filesResponse)),
    });

    // First login
    await login('test@example.com', 'password123');
    
    // Verify token was stored
    expect(localStorageMock.setItem).toHaveBeenCalledWith('auth_token', 'workflow-token');
    
    // Then call listFiles which should use the stored token
    const result = await listFiles();
    
    // Verify the second call included the Authorization header
    expect(mockFetch).toHaveBeenLastCalledWith('/api/files', {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer workflow-token',
      },
    });
    expect(result).toEqual(filesResponse);
  });

  test('should handle logout and subsequent API calls', async () => {
    // Set up initial state
    localStorageMock.getItem.mockReturnValue('initial-token');
    
    // Logout
    logout();
    
    // Mock API response without auth
    const response = { data: 'public data' };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: jest.fn().mockResolvedValueOnce(JSON.stringify(response)),
    });
    
    // Make API call after logout
    await api('/api/public');
    
    // Verify no Authorization header is sent
    expect(mockFetch).toHaveBeenCalledWith('/api/public', {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  });
});