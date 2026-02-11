import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { API_BASE } from '../config';
import { useAuthStore } from './AuthContext';
import { useNavigate } from 'react-router-dom';

type LoginTab = 'sso' | 'local';

export default function LoginPage() {
  const { t } = useTranslation('auth');
  const [agree, setAgree] = useState(false);
  const [activeTab, setActiveTab] = useState<LoginTab>('sso');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const setAuth = useAuthStore(state => state.setAuth);
  const navigate = useNavigate();

  // 页面加载时从localStorage读取协议勾选状态
  useEffect(() => {
    const savedAgree = localStorage.getItem('user_agreement_accepted');
    if (savedAgree === 'true') {
      setAgree(true);
    }
  }, []);

  // 处理协议勾选变化，并保存到localStorage
  const handleAgreeChange = (checked: boolean) => {
    setAgree(checked);
    if (checked) {
      localStorage.setItem('user_agreement_accepted', 'true');
    } else {
      localStorage.removeItem('user_agreement_accepted');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!agree) {
      setError(t('agreeFirst'));
      return;
    }

    if (activeTab === 'local') {
      // 本地账号登录
      if (!username || !password) {
        setError(t('agreeFirst'));
        return;
      }

      setIsLoading(true);
      try {
        const response = await fetch(`${API_BASE}/auth/login/local`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ username, password }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || t('loginFailed'));
        }

        const data = await response.json();

        // 保存token到localStorage，供API client使用
        localStorage.setItem('token', data.access_token);

        // 获取完整的用户信息
        try {
          const userResponse = await fetch(`${API_BASE}/users/me`, {
            headers: {
              'Authorization': `Bearer ${data.access_token}`,
            },
          });

          if (userResponse.ok) {
            const userData = await userResponse.json();
            setAuth(data.access_token, userData);
          } else {
            // 如果获取用户信息失败，使用登录响应中的基本信息
            setAuth(data.access_token, {
              id: 0,
              username: data.username,
              email: data.email,
              full_name: data.username,
              role: data.role,
              is_active: true,
              cpu_quota: 4.0,
              memory_quota: 8.0,
              gpu_quota: 1,
              cpu_used: 0,
              memory_used: 0,
              gpu_used: 0,
              created_at: new Date().toISOString(),
              last_login_at: new Date().toISOString(),
            });
          }
        } catch (e) {
          // 使用登录响应中的基本信息
          setAuth(data.access_token, {
            id: 0,
            username: data.username,
            email: data.email,
            full_name: data.username,
            role: data.role,
            is_active: true,
            cpu_quota: 4.0,
            memory_quota: 8.0,
            gpu_quota: 1,
            cpu_used: 0,
            memory_used: 0,
            gpu_used: 0,
            created_at: new Date().toISOString(),
            last_login_at: new Date().toISOString(),
          });
        }

        // 跳转到主页
        navigate('/');
      } catch (error: any) {
        setError(error.message || t('loginFailed'));
      } finally {
        setIsLoading(false);
      }
    } else {
      // SSO 登录
      setIsLoading(true);
      window.location.href = `${API_BASE}/auth/login/sso`;
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900" style={{ display: "flex", minHeight: "100vh" }}>
      {/* 左侧 */}
      <div style={{
        background: "linear-gradient(135deg, #2060e8 80%, #1a3fa7 100%)",
        color: "#fff",
        flex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "60px 50px"
      }}>
        <div style={{ fontSize: 32, fontWeight: "bold", marginBottom: 20 }}>{t('appName', { ns: 'common' })}</div>
        <div style={{ fontSize: 22, marginBottom: 30, letterSpacing: 2 }}>{t('platformSubtitle')}</div>
        <ul style={{ fontSize: 16, lineHeight: "2", paddingLeft: 20, margin: 0 }}>
          <li style={{ marginBottom: 14 }}>
            <span style={{ color: "#5ff", marginRight: 6 }}>●</span>
            {t('featureConvenient')}
            <div style={{ fontSize: 13, color: "#c3e6ff", marginLeft: 18 }}>
              {t('featureConvenientDesc')}
            </div>
          </li>
          <li style={{ marginBottom: 14 }}>
            <span style={{ color: "#5ff", marginRight: 6 }}>●</span>
            {t('featurePowerful')}
            <div style={{ fontSize: 13, color: "#c3e6ff", marginLeft: 18 }}>
              {t('featurePowerfulDesc')}
            </div>
          </li>
          <li>
            <span style={{ color: "#5ff", marginRight: 6 }}>●</span>
            {t('featureSecure')}
            <div style={{ fontSize: 13, color: "#c3e6ff", marginLeft: 18 }}>
              {t('featureSecureDesc')}
            </div>
          </li>
        </ul>
      </div>

      {/* 右侧 */}
      <div className="flex-1 flex flex-col justify-center items-center bg-white dark:bg-gray-800" style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center"
      }}>
        <form
          onSubmit={handleLogin}
          style={{
            width: 420,
            background: "#fff",
            boxShadow: "0 2px 12px rgba(224, 227, 236, 0.3)",
            borderRadius: 12,
            padding: "40px 38px",
            marginTop: -60,
            minHeight: 520
          }}
        >
          {/* Logo+标题 */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 26
          }}>
            <div style={{
              background: "#2060e8",
              borderRadius: "50%",
              width: 38,
              height: 38,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 12
            }}>
              <span style={{ color: "#fff", fontWeight: 700, fontSize: 17 }}>K8S</span>
            </div>
            <div style={{ fontSize: 23, fontWeight: 600 }}>
              {t('appName', { ns: 'common' })}
            </div>
            <span style={{ color: "#b0b9c8", fontSize: 18, marginLeft: 8, fontWeight: 400 }}>{t('platformTitle')}</span>
          </div>

          {/* 标签切换 */}
          <div style={{ display: "flex", gap: 8, marginBottom: 24, marginTop: 20 }}>
            <button
              type="button"
              onClick={() => {
                setActiveTab('sso');
                setError('');
                setUsername('');
                setPassword('');
              }}
              style={{
                flex: 1,
                padding: "10px 16px",
                fontSize: 15,
                fontWeight: 600,
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                transition: "all 0.2s",
                background: activeTab === 'sso'
                  ? "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)"
                  : "#f1f5f9",
                color: activeTab === 'sso' ? "#fff" : "#64748b",
                boxShadow: activeTab === 'sso' ? "0 4px 12px rgba(30, 64, 175, 0.3)" : "none"
              }}
            >
              {t('ssoLogin')}
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('local');
                setError('');
                setUsername('');
                setPassword('');
              }}
              style={{
                flex: 1,
                padding: "10px 16px",
                fontSize: 15,
                fontWeight: 600,
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                transition: "all 0.2s",
                background: activeTab === 'local'
                  ? "linear-gradient(135deg, #2060e8 0%, #06b6d4 100%)"
                  : "#f1f5f9",
                color: activeTab === 'local' ? "#fff" : "#64748b",
                boxShadow: activeTab === 'local' ? "0 4px 12px rgba(32, 96, 232, 0.3)" : "none"
              }}
            >
              {t('localLogin')}
            </button>
          </div>

          {/* 错误提示 */}
          {error && (
            <div style={{
              background: "#fee",
              color: "#c33",
              padding: "10px 14px",
              borderRadius: 6,
              fontSize: 14,
              marginBottom: 20,
              border: "1px solid #fcc"
            }}>
              {error}
            </div>
          )}

          {/* 标签内容 */}
          {activeTab === 'sso' ? (
            <div>
              <div style={{
                textAlign: "center",
                fontSize: 15,
                color: "#666",
                marginBottom: 24
              }}>
                {t('ssoDescription')}
              </div>
            </div>
          ) : (
            <div style={{ marginBottom: 20 }}>
              <input
                type="text"
                placeholder={t('enterUsername')}
                value={username}
                onChange={e => setUsername(e.target.value)}
                style={{
                  width: "100%",
                  padding: "11px 13px",
                  fontSize: 16,
                  marginBottom: 16,
                  border: "1px solid #d1d5db",
                  borderRadius: 7,
                  outline: "none"
                }}
              />
              <input
                type="password"
                placeholder={t('enterPassword')}
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{
                  width: "100%",
                  padding: "11px 13px",
                  fontSize: 16,
                  border: "1px solid #d1d5db",
                  borderRadius: 7,
                  outline: "none"
                }}
              />
            </div>
          )}

          {/* 协议 */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 14, color: "#555", display: "flex", alignItems: "flex-start" }}>
              <input
                type="checkbox"
                checked={agree}
                onChange={e => handleAgreeChange(e.target.checked)}
                style={{ marginRight: 7, accentColor: "#2060e8", marginTop: 2 }}
              />
              <div>
                {t('agreement')}
                <a href="#" style={{ color: "#2060e8", textDecoration: "underline", marginLeft: 2 }}>{t('userAgreement')}</a>
                {agree && (
                  <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
                    {t('agreementSaved')}
                  </div>
                )}
              </div>
            </label>
          </div>

          {/* 登录按钮 */}
          <button
            type="submit"
            disabled={!agree || isLoading}
            style={{
              width: "100%",
              padding: "13px 0",
              fontSize: 17,
              fontWeight: 700,
              background: (agree && !isLoading)
                ? (activeTab === 'sso'
                    ? "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)"
                    : "linear-gradient(135deg, #2060e8 0%, #06b6d4 100%)")
                : "#d2d8e0",
              color: "#fff",
              border: "none",
              borderRadius: 7,
              cursor: (agree && !isLoading) ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: (agree && !isLoading)
                ? (activeTab === 'sso'
                    ? "0 4px 12px rgba(30, 64, 175, 0.3)"
                    : "0 4px 12px rgba(32, 96, 232, 0.3)")
                : "none"
            }}
          >
            {isLoading ? (
              <>
                <span style={{ marginRight: 8 }}>{t('loggingIn')}</span>
                <span style={{
                  display: "inline-block",
                  width: 12,
                  height: 12,
                  border: "2px solid #fff",
                  borderTop: "2px solid transparent",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite"
                }}>
                </span>
                <style>{`
                  @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                  }
                `}</style>
              </>
            ) : (
              activeTab === 'sso' ? t('ssoLogin') : t('localLogin')
            )}
          </button>

          {/* 注册提醒 - 仅在统一认证标签显示 */}
          {activeTab === 'sso' && (
            <div style={{ marginTop: 20, textAlign: "center" }}>
              <a
                href="https://newlogin.ihep.ac.cn/admin/register"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 14,
                  color: "#64748b",
                  textDecoration: "none",
                  transition: "color 0.2s"
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = "#2060e8"}
                onMouseLeave={(e) => e.currentTarget.style.color = "#64748b"}
              >
                <span>❓</span>
                <span>{t('noAccount')}</span>
                <span style={{ color: "#2060e8", fontWeight: 600 }}>{t('registerNow')}</span>
              </a>
            </div>
          )}

          <div style={{ fontSize: 12, color: "#bbb", marginTop: 32, textAlign: "center" }}>
            京ICP备05002790号-1 © 中国科学院高能物理研究所
            <a href="#" style={{ color: "#2060e8", marginLeft: 10 }}>联系我们</a>
          </div>
        </form>
      </div>
    </div>
  );
}
