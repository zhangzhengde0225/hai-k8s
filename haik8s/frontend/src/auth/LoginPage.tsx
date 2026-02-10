import { API_BASE } from '../config';

export default function LoginPage() {
  const handleSSOLogin = () => {
    window.location.href = `${API_BASE}/auth/login/sso`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-xl shadow-lg">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">HAI-K8S</h1>
          <p className="mt-2 text-gray-600">
            Kubernetes Container Management
          </p>
        </div>
        <button
          onClick={handleSSOLogin}
          className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer"
        >
          Login with IHEP SSO
        </button>
      </div>
    </div>
  );
}
