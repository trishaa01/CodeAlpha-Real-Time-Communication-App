const API_BASE_URL = 'http://localhost:8000/api'; // Django Backend URL

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface UserProfile {
  id: number;
  username: string;
  email: string;
}

export interface RoomDetails {
  roomId: string;
  name: string;
  createdBy: string;
  createdAt?: string;
}

export interface SharedFileDetail {
  id: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  uploadedBy: string;
  uploadedAt: string;
}

// Token helper functions
export const getTokens = (): AuthTokens | null => {
  const tokensStr = localStorage.getItem('auth_tokens');
  if (!tokensStr) return null;
  try {
    return JSON.parse(tokensStr);
  } catch {
    return null;
  }
};

export const setTokens = (tokens: AuthTokens) => {
  localStorage.setItem('auth_tokens', JSON.stringify(tokens));
};

export const removeTokens = () => {
  localStorage.removeItem('auth_tokens');
};

export const getUser = (): string | null => {
  return localStorage.getItem('username');
};

export const setUser = (username: string) => {
  localStorage.setItem('username', username);
};

export const removeUser = () => {
  localStorage.removeItem('username');
};

// Custom fetch wrapper
async function apiRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
  const tokens = getTokens();
  const headers = new Headers(options.headers || {});

  if (tokens?.access) {
    headers.set('Authorization', `Bearer ${tokens.access}`);
  }

  // Auto set content-type to application/json unless it's FormData (for file uploads)
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // Token expired or invalid
    removeTokens();
    removeUser();
    window.location.href = '/auth';
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || errorData.detail || 'API Request failed');
  }

  // Handle binary stream for downloads
  const contentType = response.headers.get('content-type');
  if (contentType && !contentType.includes('application/json')) {
    return response;
  }

  return response.json();
}

// API methods
export const api = {
  signup: async (username: string, password: string, email?: string): Promise<{ username: string; tokens: AuthTokens }> => {
    const data = await apiRequest('/auth/signup/', {
      method: 'POST',
      body: JSON.stringify({ username, password, email }),
    });
    setTokens(data.tokens);
    setUser(data.username);
    return data;
  },

  login: async (username: string, password: string): Promise<AuthTokens> => {
    const data = await apiRequest('/auth/login/', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    setTokens(data);
    setUser(username);
    return data;
  },

  getProfile: async (): Promise<UserProfile> => {
    return apiRequest('/auth/profile/');
  },

  createRoom: async (name: string): Promise<RoomDetails> => {
    return apiRequest('/rooms/create/', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  },

  verifyRoom: async (roomId: string): Promise<RoomDetails> => {
    return apiRequest(`/rooms/verify/${roomId}/`);
  },

  listFiles: async (roomId: string): Promise<SharedFileDetail[]> => {
    return apiRequest(`/rooms/${roomId}/files/`);
  },

  uploadFile: async (roomId: string, file: File): Promise<SharedFileDetail> => {
    const formData = new FormData();
    formData.append('file', file);

    return apiRequest(`/rooms/${roomId}/files/upload/`, {
      method: 'POST',
      body: formData,
    });
  },

  downloadFile: async (fileId: string, originalName: string): Promise<void> => {
    const response = await apiRequest(`/files/download/${fileId}/`);
    
    // Get file blob
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    
    // Create temp link and click it to download
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', originalName);
    document.body.appendChild(link);
    link.click();
    
    // Clean up
    link.parentNode?.removeChild(link);
    window.URL.revokeObjectURL(url);
  },
};
