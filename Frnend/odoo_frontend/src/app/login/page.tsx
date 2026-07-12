'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';

// 1. binder tag illustration SVG (A-0114)
const BinderGraphic = () => (
  <svg width="110" height="110" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ margin: '8px auto', display: 'block' }}>
    {/* Grid Background Effect */}
    <path d="M 20 10 L 20 110 M 40 10 L 40 110 M 60 10 L 60 110 M 80 10 L 80 110 M 100 10 L 100 110" stroke="var(--border-subtle)" strokeWidth="0.5" strokeDasharray="3 3" />
    <path d="M 10 20 L 110 20 M 10 40 L 110 40 M 10 60 L 110 60 M 10 80 L 110 80 M 10 100 L 110 100" stroke="var(--border-subtle)" strokeWidth="0.5" strokeDasharray="3 3" />

    {/* Binder Shadow / Base */}
    <rect x="36" y="32" width="48" height="60" rx="6" fill="#DDE7F6" />

    {/* Binder Spine (Left Side) */}
    <rect x="32" y="28" width="12" height="60" rx="3" fill="#3B82F6" stroke="#1E3A8A" strokeWidth="2" />
    <circle cx="38" cy="38" r="2.5" fill="#FFFFFF" />
    <circle cx="38" cy="58" r="2.5" fill="#FFFFFF" />
    <circle cx="38" cy="78" r="2.5" fill="#FFFFFF" />

    {/* Binder Cover (Right Side) */}
    <rect x="44" y="28" width="36" height="60" rx="3" fill="#EEF4FC" stroke="#1E3A8A" strokeWidth="2" />

    {/* Asset Tag Hanging */}
    <path d="M 52 44 L 56 36 L 68 36 L 72 44 L 72 64 L 52 64 Z" fill="#FFFFFF" stroke="#1E3A8A" strokeWidth="2" />
    {/* Ring connection */}
    <circle cx="62" cy="40" r="1.5" fill="none" stroke="#1E3A8A" strokeWidth="1.5" />
    <path d="M 62 38 C 62 32, 48 32, 48 40" fill="none" stroke="#1E3A8A" strokeWidth="1.5" />

    {/* Tag Content */}
    <rect x="56" y="48" width="12" height="6" rx="1" fill="#EBF2FF" stroke="#3B82F6" strokeWidth="1" />
    <text x="62" y="52.5" fontSize="4.5" fontWeight="bold" fill="#1E3A8A" textAnchor="middle">A-0114</text>

    {/* Checkmark Badge on Bottom Right of Binder */}
    <circle cx="76" cy="80" r="10" fill="#EBF5FF" stroke="#3B82F6" strokeWidth="2" />
    <path d="M 72 80 L 75 83 L 81 77" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// 2. Center Ring Orbiting Illustration SVG
const OrbitingGraphic = () => (
  <svg width="340" height="340" viewBox="0 0 340 340" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ margin: '0 auto', display: 'block' }}>
    {/* Outer Orbiting Dotted Ring */}
    <circle cx="170" cy="170" r="120" stroke="#3B82F6" strokeWidth="1" strokeDasharray="4 4" opacity="0.3" />

    {/* Inner Orbiting Dotted Ring */}
    <circle cx="170" cy="170" r="85" stroke="#3B82F6" strokeWidth="1" strokeDasharray="4 4" opacity="0.2" />

    {/* Central Shield/Binder base with gears & calendar */}
    <circle cx="170" cy="170" r="54" fill="#E0EBFF" />

    {/* Shield outline */}
    <path d="M 170 132 C 182 132, 202 136, 206 148 C 206 172, 186 198, 170 208 C 154 198, 134 172, 134 148 C 138 136, 158 132, 170 132 Z" fill="#EEF4FC" stroke="#1E3A8A" strokeWidth="2.5" />

    {/* Inside Shield: Gear and tag */}
    <path d="M 152 172 L 157 160 L 175 160 L 180 172 L 180 190 L 152 190 Z" fill="#FFFFFF" stroke="#1E3A8A" strokeWidth="2" />
    <circle cx="166" cy="166" r="2" fill="none" stroke="#1E3A8A" strokeWidth="1.5" />
    {/* Tiny gear */}
    <circle cx="166" cy="178" r="4" fill="none" stroke="#1E3A8A" strokeWidth="1.5" />
    <path d="M 166 172 L 166 184 M 160 178 L 172 178" stroke="#1E3A8A" strokeWidth="1.5" />

    {/* Calendar inside shield */}
    <rect x="180" y="174" width="16" height="16" rx="2" fill="#FFFFFF" stroke="#1E3A8A" strokeWidth="2" />
    <rect x="180" y="178" width="16" height="3" fill="#3B82F6" />
    <circle cx="184" cy="184" r="1" fill="#1E3A8A" />
    <circle cx="188" cy="184" r="1" fill="#1E3A8A" />
    <circle cx="192" cy="184" r="1" fill="#1E3A8A" />

    {/* Orbiting Icon 1: Laptop */}
    <circle cx="108" cy="80" r="16" fill="#FFFFFF" stroke="#1E3A8A" strokeWidth="2" />
    <rect x="98" y="74" width="20" height="12" rx="1.5" fill="none" stroke="#1E3A8A" strokeWidth="1.5" />
    <path d="M 94 86 L 122 86" stroke="#1E3A8A" strokeWidth="2" strokeLinecap="round" />

    {/* Orbiting Icon 2: Chair */}
    <circle cx="232" cy="80" r="16" fill="#FFFFFF" stroke="#1E3A8A" strokeWidth="2" />
    <path d="M 226 72 L 238 72 M 226 78 L 238 78 M 228 72 L 228 84 M 236 72 L 236 84 M 230 84 L 234 84 M 232 84 L 232 90 M 226 90 L 238 90" stroke="#1E3A8A" strokeWidth="1.5" strokeLinecap="round" />

    {/* Orbiting Icon 3: Delivery Truck */}
    <circle cx="292" cy="170" r="16" fill="#FFFFFF" stroke="#1E3A8A" strokeWidth="2" />
    <rect x="280" y="162" width="16" height="10" rx="1" fill="none" stroke="#1E3A8A" strokeWidth="1.5" />
    <path d="M 296 166 L 302 166 L 302 172 L 296 172 Z" fill="none" stroke="#1E3A8A" strokeWidth="1.5" />
    <circle cx="285" cy="174" r="2" fill="#FFFFFF" stroke="#1E3A8A" strokeWidth="1.5" />
    <circle cx="297" cy="174" r="2" fill="#FFFFFF" stroke="#1E3A8A" strokeWidth="1.5" />

    {/* Orbiting Icon 4: Chart */}
    <circle cx="232" cy="260" r="16" fill="#FFFFFF" stroke="#1E3A8A" strokeWidth="2" />
    <rect x="222" y="250" width="20" height="12" fill="none" stroke="#1E3A8A" strokeWidth="1.5" />
    <path d="M 220 250 L 244 250 M 226 262 L 222 268 M 238 262 L 242 268" stroke="#1E3A8A" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="232" cy="256" r="2" fill="#3B82F6" />

    {/* Orbiting Icon 5: Calendar */}
    <circle cx="170" cy="292" r="16" fill="#FFFFFF" stroke="#1E3A8A" strokeWidth="2" />
    <rect x="160" y="282" width="20" height="18" rx="2" fill="none" stroke="#1E3A8A" strokeWidth="1.5" />
    <path d="M 160 288 L 180 288 M 165 280 L 165 284 M 175 280 L 175 284" stroke="#1E3A8A" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="170" cy="294" r="2.5" fill="#3B82F6" />

    {/* Orbiting Icon 6: Wrench */}
    <circle cx="108" cy="260" r="16" fill="#FFFFFF" stroke="#1E3A8A" strokeWidth="2" />
    <circle cx="108" cy="258" r="4.5" fill="none" stroke="#1E3A8A" strokeWidth="1.5" />
    <path d="M 103 263 L 98 268" stroke="#1E3A8A" strokeWidth="2" strokeLinecap="round" />

    {/* Orbiting Icon 7: QR Scanner */}
    <circle cx="48" cy="170" r="16" fill="#FFFFFF" stroke="#1E3A8A" strokeWidth="2" />
    <rect x="39" y="161" width="18" height="18" rx="2" fill="none" stroke="#1E3A8A" strokeWidth="1.5" strokeDasharray="3 2" />
    <path d="M 35 170 L 61 170" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M 43 176 L 43 182" stroke="#1E3A8A" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export default function LoginPage() {
  const router = useRouter();
  const { loginUser, signupUser, theme, setTheme } = useApp();

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('Engineering');

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validations
    if (!email) {
      setError('Email is required.');
      return;
    }
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (!isLogin && !name) {
      setError('Full Name is required for signup.');
      return;
    }

    setLoading(true);

    if (isLogin) {
      const res = await loginUser(email, password);
      if (res.success) {
        router.push('/dashboard');
      } else {
        setError(res.error || 'Invalid credentials.');
        setLoading(false);
      }
    } else {
      const res = await signupUser(name, email, password);
      if (res.success) {
        router.push('/dashboard');
      } else {
        setError(res.error || 'Signup failed.');
        setLoading(false);
      }
    }
  };

  return (
    <div className="login-split-container">

      {/* LEFT PANEL: Logo Header, Dynamic Graphics, Login Form, Footer */}
      <div className="login-left-panel" style={{ position: 'relative' }}>
        {/* Fixed Theme Toggler in the top-right of left panel */}
        <div style={{ position: 'absolute', top: '24px', right: '24px' }}>
          <button
            type="button"
            className="theme-toggle-btn"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            style={{
              background: 'transparent',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              width: '38px',
              height: '38px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          >
            {theme === 'dark' ? (
              /* Sun Icon */
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-11.314l.707.707m11.314 11.314l.707-.707M12 7a5 5 0 100 10 5 5 0 000-10z" />
              </svg>
            ) : (
              /* Moon Icon */
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
        </div>

        {/* Top brand header */}
        <div className="login-logo-header">
          <div className="logo-icon">AF</div>
          <span className="logo-text">AssetFlow</span>
        </div>

        {/* Form Container */}
        <div className="login-form-center">

          {/* Central binder tag graphic */}
          <BinderGraphic />

          <h2 className="login-form-heading">
            {isLogin ? 'Login to your account!' : 'Create your account!'}
          </h2>
          <p className="login-form-subtitle">
            {isLogin
              ? 'Enter your registered email and password to begin.'
              : 'Sign up to register as an Employee and request assets.'}
          </p>

          {error && (
            <div className="alert-box alert-danger" style={{ marginBottom: '16px' }}>
              <div className="alert-icon-chip">
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                </svg>
              </div>
              <div>
                <span>{error}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

            {/* Full Name (Sign Up only) */}
            {!isLogin && (
              <div className="form-group">
                <label className="form-label" htmlFor="name">Full Name</label>
                <div className="input-with-icon-wrapper">
                  <span className="input-icon-left">👤</span>
                  <input
                    id="name"
                    type="text"
                    className="form-control"
                    placeholder="Enter full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            {/* Email Address */}
            <div className="form-group">
              <label className="form-label" htmlFor="email">Email</label>
              <div className="input-with-icon-wrapper">
                <span className="input-icon-left">
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                  </svg>
                </span>
                <input
                  id="email"
                  type="email"
                  className="form-control"
                  placeholder="eg. employee@organization.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="form-group">
              <label className="form-label" htmlFor="password">Password</label>
              <div className="input-with-icon-wrapper">
                <span className="input-icon-left">
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </span>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className="form-control"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="input-icon-right-btn"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? '👁️' : '🙈'}
                </button>
              </div>
            </div>


            {/* Helpers row: Remember me & Forgot Password */}
            {isLogin && (
              <div className="form-helper-row">
                <label className="checkbox-label-flex">
                  <input type="checkbox" style={{ accentColor: 'var(--accent)' }} />
                  <span>Remember me</span>
                </label>
                <button type="button" className="forgot-password-link toggle-mode-link-btn" onClick={() => alert('Demo Mode: Password reset is not active.')}>
                  Forgot Password?
                </button>
              </div>
            )}

            {/* Submit Button */}
            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }} disabled={loading}>
              {loading ? (
                <span className="spinner" style={{ width: '16px', height: '16px', border: '2px solid #ffffff', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'pulse 1s infinite' }}></span>
              ) : isLogin ? (
                'Login'
              ) : (
                'Sign Up'
              )}
            </button>
          </form>
        </div>

        {/* Bottom Footer Switcher */}
        <div style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)' }}>
          {isLogin ? (
            <p>
              Don't have an account?{' '}
              <button className="toggle-mode-link-btn" onClick={() => { setIsLogin(false); setError(''); }}>
                SignUp
              </button>{' '}
              for an Employee account
            </p>
          ) : (
            <p>
              Already have an account?{' '}
              <button className="toggle-mode-link-btn" onClick={() => { setIsLogin(true); setError(''); }}>
                Sign in
              </button>
            </p>
          )}
        </div>
      </div>

      {/* RIGHT PANEL: Served SVG illustration */}
      <div className="login-right-panel" style={{ padding: '40px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: theme === 'dark' ? '#111827' : '#EBF2FF' }}>
        <img
          src="/App_login.svg"
          alt="Centralized Asset Lifecycle Management"
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      </div>

    </div>
  );
}
