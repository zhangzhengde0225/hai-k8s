import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from './AuthContext';
import { jwtDecode } from './jwt';
import client from '../api/client';

export default function CallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setError('No token received');
      return;
    }

    try {
      const decoded = jwtDecode(token);
      if (!decoded.sub || !decoded.username) {
        setError('Invalid token payload');
        return;
      }

      // Save token first so the API client picks it up
      localStorage.setItem('token', token);

      // Fetch full user info
      client.get('/users/me').then((res) => {
        setAuth(token, res.data);
        navigate('/', { replace: true });
      }).catch(() => {
        // Fallback: use token claims
        setAuth(token, {
          id: parseInt(decoded.sub),
          username: decoded.username,
          email: decoded.email || '',
          full_name: decoded.username,
          role: decoded.role || 'user',
          is_active: true,
          cpu_quota: 0,
          memory_quota: 0,
          gpu_quota: 0,
          cpu_used: 0,
          memory_used: 0,
          gpu_used: 0,
          created_at: '',
          last_login_at: null,
        });
        navigate('/', { replace: true });
      });
    } catch {
      setError('Failed to decode token');
    }
  }, [searchParams, navigate, setAuth]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <a href="/login" className="text-blue-600 underline">Back to Login</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-600">Logging in...</p>
    </div>
  );
}
