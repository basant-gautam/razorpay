import { useState, useEffect, useRef } from 'react'
import AdminDashboard from './AdminDashboard'
import CatalogManager from './CatalogManager'
import OrdersView from './OrdersView'
import './design-tokens.css'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const RZP_LINK_RE = /https:\/\/rzp\.io\/[^\s\)\]>,]+/

async function fetchWithRetry(url, options) {
  try {
    return await fetch(url, options)
  } catch (firstError) {
    // The FastAPI dev server can briefly restart while code is being updated.
    await new Promise(resolve => setTimeout(resolve, 600))
    return fetch(url, options)
  }
}

function parseMessage(content) {
  if (!content || typeof content !== 'string') return [{ text: '' }]
  const m = content.match(RZP_LINK_RE)
  if (!m) return [{ text: content }]
  const link = m[0]
  const idx = content.indexOf(link)
  const parts = []
  if (idx > 0) parts.push({ text: content.slice(0, idx) })
  parts.push({ link })
  const tail = content.slice(idx + link.length)
  if (tail) parts.push({ text: tail })
  return parts
}

function OrnamentalDivider() {
  return (
    <div className="flex items-center gap-3 my-6 px-2" role="separator">
      <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, transparent, var(--color-border-light), transparent)' }} />
      <span className="text-sm" style={{ color: 'var(--color-gold-dark)' }} aria-hidden="true">&#10070;</span>
      <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, transparent, var(--color-border-light), transparent)' }} />
    </div>
  )
}

function MessageBubble({ msg, idx }) {
  const isUser = msg.role === 'user'
  const parts = parseMessage(msg.content || '')
  const delay = `${idx * 0.1}s`

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`} style={{ animation: `fade-in 0.4s ease-out ${delay} both` }}>
      <div
        className={`max-w-xl px-6 py-4 relative ${isUser ? 'gradient-ornament-border' : ''}`}
        style={{
          fontFamily: 'var(--font-sans)',
          borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
          background: isUser
            ? 'linear-gradient(135deg, #2a1a3a 0%, #1e1430 100%)'
            : 'var(--color-surface-alt)',
          border: isUser ? 'none' : '1px solid var(--color-border)',
          boxShadow: isUser ? 'var(--shadow-gold)' : 'var(--shadow-card)',
        }}
        role="article"
        aria-label={isUser ? 'Your message' : 'Aegis AI response'}
      >
        <div className="text-sm leading-relaxed" style={{ whiteSpace: 'pre-wrap', color: isUser ? 'var(--color-cream)' : 'var(--color-text)' }}>
          {parts.map((part, i) => {
            if (part.link) {
              return (
                <a
                  key={i}
                  href={part.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 mt-3 px-6 py-3 rounded-lg font-semibold text-sm transition-all animate-glow"
                  style={{
                    fontFamily: 'var(--font-serif)',
                    background: 'linear-gradient(135deg, var(--color-gold-dark), var(--color-copper))',
                    color: 'var(--color-cream)',
                    letterSpacing: '0.02em',
                  }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                  Proceed to Payment
                </a>
              )
            }
            return (
              <span key={i}>
                {part.text.split('**').map((sub, j) =>
                  j % 2 === 1 ? (
                    <strong key={j} style={{ color: 'var(--color-gold-light)', fontFamily: 'var(--font-serif)', fontWeight: 600 }}>
                      {sub}
                    </strong>
                  ) : sub
                )}
              </span>
            )
          })}
        </div>
        <div className="text-xs mt-2 tracking-wide" style={{
          fontFamily: 'var(--font-serif)',
          fontStyle: 'italic',
          color: isUser ? 'var(--color-gold-dark)' : 'var(--color-text-dim)',
        }}>
          {isUser ? '\u2014 You' : '\u2014 Aegis AI'}
        </div>
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex justify-start" role="status" aria-label="AI is composing a response">
      <div
        className="px-6 py-4 max-w-xl"
        style={{
          fontFamily: 'var(--font-sans)',
          borderRadius: '16px 16px 16px 4px',
          background: 'var(--color-surface-alt)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div className="flex items-center gap-4">
          <div className="flex gap-1.5">
            {[0, 0.15, 0.3].map((delay, i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full animate-bounce"
                style={{ backgroundColor: 'var(--color-gold)', animationDelay: `${delay}s` }}
              />
            ))}
          </div>
          <span className="text-sm tracking-wide" style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', color: 'var(--color-text-muted)' }}>
            Aegis is composing a response
          </span>
        </div>
      </div>
    </div>
  )
}

function LandingScreen({ onEnterBuyer, onEnterMerchant }) {
  return (
    <main className="min-h-screen noise-bg flex items-center justify-center" style={{ background: 'var(--color-base)' }}>
      <div className="text-center px-6 max-w-lg w-full" style={{ animation: 'fade-in 0.8s ease-out both' }}>
        <div className="mb-12">
          <div className="w-24 h-24 mx-auto mb-8 rounded-2xl flex items-center justify-center shadow-2xl animate-glow"
            style={{ background: 'linear-gradient(135deg, #2a1a3a 0%, #1a1030 50%, #1a0a20 100%)' }}>
            <span className="text-4xl" style={{ fontFamily: 'var(--font-serif)', color: 'var(--color-gold)' }} aria-hidden="true">A</span>
          </div>
          <h1 className="text-5xl font-bold mb-3 tracking-tight sm:text-6xl" style={{ fontFamily: 'var(--font-serif)', color: 'var(--color-gold-light)' }}>
            Aegis
          </h1>
          <p className="text-lg mb-2 tracking-widest uppercase text-xs sm:text-sm" style={{ fontFamily: 'var(--font-serif)', color: 'var(--color-gold-dark)', letterSpacing: '0.3em' }}>
            Autonomous Merchant Intelligence
          </p>
          <OrnamentalDivider />
          <p className="text-sm" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-sans)' }}>
            Agent-to-Agent Commerce &bull; Razorpay Settlement Layer
          </p>
        </div>

        <nav className="space-y-5" aria-label="Role selection">
          <button
            onClick={onEnterBuyer}
            className="w-full py-5 rounded-xl font-semibold transition-all duration-300 hover:scale-[1.02] gradient-ornament-border"
            style={{
              fontFamily: 'var(--font-serif)',
              background: 'linear-gradient(135deg, #1e1635 0%, #1a1230 100%)',
              color: 'var(--color-cream)',
              letterSpacing: '0.02em',
              boxShadow: 'var(--shadow-deep)',
            }}
          >
            <span className="flex items-center justify-center gap-3 text-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--color-gold)' }} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              Enter the Marketplace
            </span>
          </button>
          <button
            onClick={onEnterMerchant}
            className="w-full py-5 rounded-xl font-semibold transition-all duration-300 hover:scale-[1.02] gradient-ornament-border"
            style={{
              fontFamily: 'var(--font-serif)',
              background: 'linear-gradient(135deg, #1f1630 0%, #1a1028 100%)',
              color: 'var(--color-cream)',
              letterSpacing: '0.02em',
              boxShadow: 'var(--shadow-deep)',
            }}
          >
            <span className="flex items-center justify-center gap-3 text-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--color-copper)' }} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Merchant Console
            </span>
          </button>
        </nav>

        <p className="text-xs mt-10" style={{ color: 'var(--color-text-dim)', fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}>
          &ldquo;Commerce, elevated.&rdquo;
        </p>
      </div>
    </main>
  )
}

function AuthScreen({ role, onSuccess, onBack }) {
  const [isLogin, setIsLogin] = useState(true)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const title = role === 'merchant' ? 'Merchant' : 'Buyer'
  const accentColor = role === 'merchant' ? 'var(--color-copper)' : 'var(--color-gold)'
  const gradientFrom = role === 'merchant' ? '#331828' : '#1e1635'
  const gradientTo = role === 'merchant' ? '#221020' : '#151225'

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!username.trim() || !password.trim()) { setError('All fields are required'); return }
    setLoading(true)
    setError('')
    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/signup'
    const body = isLogin ? { username, password, expected_role: role } : { username, password }
    try {
      const res = await fetch(`${API}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (res.ok && data.user) { onSuccess({ ...data.user, token: data.token || 'demo-token' }) }
      else { setError(data.detail || 'Authentication failed') }
    } catch { setError('Cannot reach the Aegis server') }
    setLoading(false)
  }

  return (
    <main className="min-h-screen noise-bg flex items-center justify-center" style={{ background: 'var(--color-base)' }}>
      <div className="text-center px-4 sm:px-6 max-w-sm w-full" style={{ animation: 'fade-in 0.6s ease-out both' }}>
        <div
          className="w-20 h-20 mx-auto mb-8 rounded-2xl flex items-center justify-center shadow-2xl animate-glow"
          style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}
        >
          <svg className="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: accentColor }} aria-hidden="true">
            {role === 'merchant' ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            )}
          </svg>
        </div>

        <h2 className="text-3xl font-bold mb-1" style={{ fontFamily: 'var(--font-serif)', color: 'var(--color-cream)' }}>
          {isLogin ? 'Enter' : 'Join'} the {title} Realm
        </h2>
        <p className="text-sm mb-8" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}>
          {isLogin ? 'Continue your journey' : 'Begin your journey'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="sr-only" htmlFor="username">Username</label>
            <input
              id="username" type="text" value={username} autoComplete="username"
              onChange={(e) => { setUsername(e.target.value); setError('') }}
              placeholder="Username"
              className="w-full rounded-lg px-5 py-3.5 text-sm transition-all duration-200 placeholder-current"
              style={{
                background: 'var(--color-surface)',
                color: 'var(--color-cream)',
                border: '1px solid var(--color-border)',
                outline: 'none',
                fontFamily: 'var(--font-sans)',
                boxShadow: error ? '0 0 0 2px var(--color-error-bg)' : 'none',
              }}
            />
          </div>
          <div>
            <label className="sr-only" htmlFor="password">Password</label>
            <input
              id="password" type="password" value={password} autoComplete={isLogin ? 'current-password' : 'new-password'}
              onChange={(e) => { setPassword(e.target.value); setError('') }}
              placeholder="Password"
              className="w-full rounded-lg px-5 py-3.5 text-sm transition-all duration-200 placeholder-current"
              style={{
                background: 'var(--color-surface)',
                color: 'var(--color-cream)',
                border: '1px solid var(--color-border)',
                outline: 'none',
                fontFamily: 'var(--font-sans)',
                boxShadow: error ? '0 0 0 2px var(--color-error-bg)' : 'none',
              }}
            />
          </div>
          {error && (
            <div className="rounded-lg px-4 py-2.5 text-sm text-left" role="alert"
              style={{ background: 'var(--color-error-bg)', border: '1px solid var(--color-error-border)', color: 'var(--color-error)', fontFamily: 'var(--font-sans)' }}>
              {error}
            </div>
          )}
          <button
            type="submit" disabled={loading}
            className="w-full py-3.5 rounded-lg text-sm font-semibold transition-all duration-300 hover:scale-[1.02] tracking-wide"
            style={{
              fontFamily: 'var(--font-serif)',
              background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`,
              color: 'var(--color-cream)',
              border: `1px solid ${accentColor}33`,
              boxShadow: `0 0 30px ${accentColor}15`,
              letterSpacing: '0.04em',
              opacity: loading ? 0.7 : 1,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Authenticating...' : (isLogin ? 'Sign In' : 'Create Account')}
          </button>
        </form>

        <div className="mt-6 space-y-3">
          {role === 'buyer' && (
            <button onClick={() => { setIsLogin(!isLogin); setError('') }}
              className="w-full py-2.5 rounded-lg text-sm transition-all"
              style={{ background: 'transparent', color: 'var(--color-text-muted)', fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}
            >
              {isLogin ? 'New to Aegis? Create a buyer account' : 'Returning? Sign in'}
            </button>
          )}
          {role === 'merchant' && (
            <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>Merchant accounts are provisioned by the platform.</p>
          )}
          <button onClick={onBack}
            className="w-full py-2.5 rounded-lg text-sm transition-all"
            style={{ background: 'transparent', color: 'var(--color-text-dim)', border: '1px solid var(--color-border)', fontFamily: 'var(--font-sans)' }}
          >
            Return to Landing
          </button>
        </div>
      </div>
    </main>
  )
}

function Sidebar({ user, activeTab, onTabChange, onLogout, onClose }) {
  const merchantItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { id: 'orders', label: 'Orders & Invoices', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
    { id: 'audit-logs', label: 'Audit Ledger', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
    { id: 'catalog', label: 'Catalog Management', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
  ]
  const buyerItems = [
    { id: 'shop', label: 'Shop via AI', icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z' },
    { id: 'orders', label: 'My Orders', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
    { id: 'profile', label: 'Profile', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
  ]
  const items = user?.role === 'merchant' ? merchantItems : buyerItems

  // Don't lock body scroll - fixed sidebar already overlays without needing overflow hidden

  if (!user) return null
  return (
    <>
      <div className="fixed inset-0 backdrop-blur-sm" style={{ background: 'rgba(5, 3, 12, 0.75)', zIndex: 40 }} onClick={onClose} aria-hidden="true" />
      <aside className="fixed top-0 left-0 h-full flex flex-col animate-slide-in gradient-ornament-border overflow-hidden"
        style={{
          zIndex: 50,
          width: 'min(320px, 85vw)',
          background: 'linear-gradient(180deg, #191330 0%, #151025 100%)',
          borderRight: '1px solid var(--color-border)',
        }}
        role="dialog"
        aria-label="Navigation menu"
      >
        <div className="flex items-center justify-between px-6 py-6 border-b flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shadow-lg"
              style={{
                fontFamily: 'var(--font-serif)',
                background: (user?.role === 'merchant')
                  ? 'linear-gradient(135deg, #4a1a30, #2a1020)'
                  : 'linear-gradient(135deg, #2a1a3a, #1a1030)',
                color: (user?.role === 'merchant') ? 'var(--color-copper)' : 'var(--color-gold)',
              }}
              aria-hidden="true">
              {(user?.username?.[0] || 'U').toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--color-cream)', fontFamily: 'var(--font-serif)' }}>{user?.username}</p>
              <p className="text-xs uppercase tracking-widest" style={{ color: 'var(--color-text-dim)', fontFamily: 'var(--font-sans)' }}>{user?.role}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--color-text-dim)' }}
            aria-label="Close navigation menu">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-3 px-6 py-3 border-b flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
          <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, transparent, var(--color-border-light), transparent)' }} />
          <span className="text-xs uppercase tracking-widest" style={{ color: 'var(--color-text-dim)', fontFamily: 'var(--font-serif)' }}>Navigation</span>
          <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, transparent, var(--color-border-light), transparent)' }} />
        </div>

        <nav className="flex-1 px-4 py-3 space-y-1 overflow-y-auto" aria-label="Main navigation">
          {items.map(item => (
            <button
              key={item.id}
              onClick={() => { onTabChange(item.id); setTimeout(onClose, 50) }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200"
              style={{
                fontFamily: 'var(--font-serif)',
                color: activeTab === item.id ? 'var(--color-cream)' : 'var(--color-text-muted)',
                background: activeTab === item.id ? 'var(--color-warning-bg)' : 'transparent',
                border: activeTab === item.id ? '1px solid var(--color-warning-border)' : '1px solid transparent',
                boxShadow: activeTab === item.id ? '0 0 20px rgba(180, 140, 60, 0.06)' : 'none',
              }}
              aria-current={activeTab === item.id ? 'page' : undefined}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
              </svg>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="border-t px-4 py-4 flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
          <button onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200"
            style={{ fontFamily: 'var(--font-serif)', color: 'var(--color-error)', background: 'var(--color-error-bg)', border: '1px solid var(--color-error-border)' }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Depart
          </button>
        </div>
      </aside>
    </>
  )
}

function ShopView({ user }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: `Greetings, ${user.username}. I am Aegis \u2014 autonomous merchant intelligence. Browse our catalog and I shall negotiate on your behalf. What do you seek today?` }
  ])
  const [products, setProducts] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    fetch(`${API}/api/products`)
      .then(res => res.json())
      .then(data => setProducts(data.products || []))
      .catch(() => {})
  }, [])

  const addMessage = (role, content) => {
    setMessages(prev => [...prev, { role, content }])
  }

  const authHeaders = { Authorization: `Bearer ${user.token}` }

  const downloadInvoice = async (paymentLinkId, invoiceNumber = 'invoice') => {
    const res = await fetch(`${API}/api/payment-links/${paymentLinkId}/invoice/download`, { headers: authHeaders })
    if (!res.ok) throw new Error('Invoice download failed')
    const blob = await res.blob()
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${invoiceNumber}.pdf`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(link.href)
  }

  const watchForInvoice = async (paymentLinkId, attempts = 0) => {
    if (attempts >= 90) return
    try {
      const res = await fetch(`${API}/api/payment-links/${paymentLinkId}/invoice`, { headers: authHeaders })
      if (res.ok) {
        const invoice = await res.json()
        addMessage('assistant', `Payment received. Invoice ${invoice.invoice_number} is ready — downloading your PDF now.`)
        await downloadInvoice(paymentLinkId, invoice.invoice_number)
        return
      }
    } catch { /* Keep checking while the buyer completes Razorpay checkout. */ }
    window.setTimeout(() => watchForInvoice(paymentLinkId, attempts + 1), 5000)
  }

  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!input.trim() || loading) return
    const userMessage = input.trim()
    setInput('')
    setLoading(true)

    const updatedMessages = [...messages, { role: 'user', content: userMessage }]
    setMessages(updatedMessages)

    const history = messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .slice(-8)
      .map(m => ({ role: m.role, content: m.content }))

    try {
      const res = await fetchWithRetry(`${API}/api/agent/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ buyer_message: userMessage, history, buyer_username: user.username }),
      })
      const data = await res.json()
      const reply = res.ok ? (data.reply || 'Forgive me \u2014 I could not formulate a response.') : (data.detail || 'The Aegis service could not process that request.')
      // Extract hidden payment_link_id for auto-verify polling
      const cleanReply = reply.replace(/\[payment_link_id:[^\]]+\]/, '').trim()
      addMessage('assistant', cleanReply)
      const payIdMatch = reply.match(/\[payment_link_id:([^\]]+)\]/)
      if (payIdMatch) {
        // Start polling for this AI-generated payment link
        setTimeout(() => watchForInvoice(payIdMatch[1]), 2000)
      }
      const invoiceMatch = reply.match(/payment-links\/([^/]+)\/invoice\/download/)
      if (invoiceMatch) await downloadInvoice(invoiceMatch[1])
    } catch {
      addMessage('assistant', 'Aegis is temporarily reconnecting. Please send your message once more in a moment.')
    }
    setLoading(false)
  }

  const handleBuyNow = async (product) => {
    addMessage('user', `I wish to purchase ${product.name}`)
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/agent/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ product_id: product.id, final_discounted_price: product.price, buyer_username: user.username }),
      })
      const data = await res.json()
      if (data.status === 'success' && data.payment_link) {
        watchForInvoice(data.payment_link_id)
        addMessage('assistant', `Your payment link is ready!\n\n${data.payment_link}\n\n**Item:** ${product.name}\n**Amount:** \u20b9${product.price}\n\nComplete the payment, then type “invoice please” and I’ll verify it and issue your invoice.`)
      } else {
        addMessage('assistant', `Payment link generation failed: ${data.message || 'Unknown error'}`)
      }
    } catch {
      addMessage('assistant', 'Cannot reach the Aegis settlement layer.')
    }
    setLoading(false)
  }

  return (
    <div className="flex-1 flex flex-col" style={{ background: 'var(--color-base)' }}>
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6" role="log" aria-label="Chat messages">
        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} idx={i} />
        ))}
        {loading && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t p-4 noise-bg flex-shrink-0"
        style={{ background: 'linear-gradient(180deg, transparent, var(--color-surface))', borderColor: 'var(--color-border)' }}>
        {products.length > 0 && (
          <div className="flex gap-3 mb-4 overflow-x-auto pb-3 -mx-1 px-1">
            {products.map(product => (
              <button key={product.id} onClick={() => handleBuyNow(product)}
                className="flex-shrink-0 px-5 py-3 rounded-lg text-sm transition-all duration-200 hover:scale-[1.02] gradient-ornament-border"
                style={{
                  fontFamily: 'var(--font-serif)',
                  background: 'var(--color-surface-alt)',
                  color: 'var(--color-cream)',
                  border: '1px solid var(--color-border)',
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                <span style={{ color: 'var(--color-gold-light)' }}>{product.name}</span>
                <span className="block text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                  &mdash; \u20b9{product.price}
                </span>
              </button>
            ))}
          </div>
        )}
        <form onSubmit={handleSendMessage} className="flex gap-3">
          <label className="sr-only" htmlFor="chat-input">Type your message</label>
          <input
            id="chat-input" type="text" value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Inquire about merchandise..."
            className="flex-1 rounded-lg px-5 py-3.5 text-sm transition-all duration-200 placeholder-current"
            style={{
              background: 'var(--color-surface-alt)',
              color: 'var(--color-cream)',
              border: '1px solid var(--color-border)',
              outline: 'none',
              fontFamily: 'var(--font-sans)',
            }}
          />
          <button
            type="submit" disabled={loading}
            className="px-7 py-3.5 rounded-lg text-sm font-semibold transition-all duration-200 hover:scale-[1.02] tracking-wide gradient-ornament-border"
            style={{
              fontFamily: 'var(--font-serif)',
              background: 'linear-gradient(135deg, #2a1a3a, #1a1430)',
              color: 'var(--color-cream)',
              boxShadow: 'var(--shadow-gold)',
              letterSpacing: '0.04em',
              opacity: loading ? 0.6 : 1,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  )
}

function PlaceholderPanel({ title, icon }) {
  return (
    <div className="flex-1 flex items-center justify-center p-8" style={{ background: 'var(--color-base)' }}>
      <div className="text-center" style={{ animation: 'fade-in 0.5s ease-out both' }}>
        <div className="w-24 h-24 mx-auto mb-6 rounded-2xl flex items-center justify-center"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--color-text-dim)' }} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d={icon} />
          </svg>
        </div>
        <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: 'var(--font-serif)', color: 'var(--color-cream)' }}>{title}</h2>
        <p className="text-sm italic" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-serif)' }}>
          This wing of Aegis is still under construction
        </p>
      </div>
    </div>
  )
}

function DashboardLayout({ user, onLogout }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeTab, setActiveTab] = useState(user?.role === 'merchant' ? 'dashboard' : 'shop')
  // Reset to valid tab if role mismatch after long chat
  useEffect(() => {
    if (user?.role === 'buyer' && !['shop','orders','profile'].includes(activeTab)) setActiveTab('shop')
    if (user?.role === 'merchant' && !['dashboard','orders','audit-logs','catalog'].includes(activeTab)) setActiveTab('dashboard')
  }, [user, activeTab])

  const renderPanel = () => {
    try {
      if (user.role === 'merchant') {
        switch (activeTab) {
          case 'dashboard':
            return <AdminDashboard initialTab="analytics" user={user} />
          case 'audit-logs':
            return <AdminDashboard initialTab="audit" user={user} />
          case 'catalog':
            return <CatalogManager />
          case 'orders':
            return <AdminDashboard initialTab="orders" user={user} />
          default: return <AdminDashboard initialTab="analytics" user={user} />
        }
      }
      switch (activeTab) {
        case 'shop': return <ShopView user={user} />
        case 'orders': return <OrdersView user={user} />
        case 'profile': return <PlaceholderPanel title="Your Profile" icon="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        default: return <ShopView user={user} />
      }
    } catch (e) {
      console.error('Panel error', e)
      return <div className="p-8 text-center text-sm" style={{color:'var(--color-text-muted)'}}>Something went wrong - please refresh</div>
    }
  }

  const tabLabel = () => {
    const labels = {
      dashboard: 'Dashboard', 'audit-logs': 'Audit Ledger', catalog: 'Catalog Management',
      shop: 'Shop via AI', orders: 'My Orders', profile: 'Profile',
    }
    return labels[activeTab] || ''
  }

  return (
    <div className="h-screen flex flex-col" style={{ background: 'var(--color-base)' }}>
      <header className="flex items-center justify-between px-4 sm:px-6 py-4 flex-shrink-0 border-b"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div className="flex items-center gap-2 sm:gap-4">
          <button onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--color-text-muted)' }}
            aria-label="Open navigation menu">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold shadow-lg flex-shrink-0"
              style={{ fontFamily: 'var(--font-serif)', background: 'linear-gradient(135deg, #2a1a3a, #1a1030)', color: 'var(--color-gold)' }}
              aria-hidden="true">
              A
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold tracking-wide truncate" style={{ fontFamily: 'var(--font-serif)', color: 'var(--color-cream)' }}>
                Aegis AI <span className="text-[10px] opacity-50">v1.2</span>
              </h1>
              <p className="text-xs tracking-widest uppercase truncate" style={{ color: 'var(--color-gold-dark)', fontFamily: 'var(--font-serif)' }}>
                {tabLabel()}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden sm:block text-right min-w-0">
            <p className="text-xs font-medium truncate" style={{ fontFamily: 'var(--font-serif)', color: 'var(--color-cream)' }}>{user.username}</p>
            <p className="text-xs uppercase tracking-widest" style={{ color: 'var(--color-text-dim)', fontFamily: 'var(--font-sans)' }}>{user.role}</p>
          </div>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold shadow-lg flex-shrink-0"
            style={{
              fontFamily: 'var(--font-serif)',
              background: user.role === 'merchant'
                ? 'linear-gradient(135deg, #4a1a30, #2a1020)'
                : 'linear-gradient(135deg, #2a1a3a, #1a1030)',
              color: user.role === 'merchant' ? 'var(--color-copper)' : 'var(--color-gold)',
            }}
            aria-hidden="true">
            {user.username[0].toUpperCase()}
          </div>
        </div>
      </header>

      {sidebarOpen && (
        <Sidebar user={user} activeTab={activeTab} onTabChange={setActiveTab} onLogout={onLogout} onClose={() => setSidebarOpen(false)} />
      )}

      {renderPanel()}
    </div>
  )
}

function App() {
  const [view, setView] = useState('landing')
  const [user, setUser] = useState(null)

  const handleAuthSuccess = (userData) => { setUser(userData); setView('dashboard') }
  const handleLogout = () => { setUser(null); setView('landing') }

  if (view === 'landing') {
    return <LandingScreen onEnterBuyer={() => setView('buyer-auth')} onEnterMerchant={() => setView('merchant-auth')} />
  }
  if (view === 'buyer-auth') {
    return <AuthScreen role="buyer" onSuccess={handleAuthSuccess} onBack={() => setView('landing')} />
  }
  if (view === 'merchant-auth') {
    return <AuthScreen role="merchant" onSuccess={handleAuthSuccess} onBack={() => setView('landing')} />
  }
  if (view === 'dashboard' && user) {
    return <DashboardLayout user={user} onLogout={handleLogout} />
  }
  return null
}

export default App
