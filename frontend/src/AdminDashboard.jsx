import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { BarChart2, Settings, Shield, TrendingUp, Link as LinkIcon, Percent, Save, Check } from 'lucide-react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function formatTimestamp(ts) {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
  })
}

function getActionStyle(action) {
  switch (action) {
    case 'discount_granted':
      return { color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)' }
    case 'discount_denied':
      return { color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }
    case 'generate_link':
      return { color: '#3b82f6', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)' }
    default:
      return { color: 'var(--color-text-muted)', background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)' }
  }
}

export default function AdminDashboard({ initialTab = 'analytics' }) {
  const [activeTab, setActiveTab] = useState(initialTab) // 'analytics', 'rules', 'audit'

  // Analytics Data
  const [analytics, setAnalytics] = useState(null)
  const [loadingAnalytics, setLoadingAnalytics] = useState(true)

  // Rules Data
  const [globalDiscount, setGlobalDiscount] = useState(15)
  const [products, setProducts] = useState([])
  const [savingGlobal, setSavingGlobal] = useState(false)
  const [savingProduct, setSavingProduct] = useState(null)
  
  // Audit Logs Data
  const [logs, setLogs] = useState([])
  const [loadingLogs, setLoadingLogs] = useState(true)

  // Toasts
  const [toast, setToast] = useState(null)

  const showToast = (message) => {
    setToast(message)
    setTimeout(() => setToast(null), 3000)
  }

  const fetchAnalytics = async () => {
    setLoadingAnalytics(true)
    try {
      const res = await fetch(`${API}/api/admin/analytics`)
      if (res.ok) setAnalytics(await res.json())
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingAnalytics(false)
    }
  }

  const fetchRulesData = async () => {
    try {
      const [settingsRes, productsRes] = await Promise.all([
        fetch(`${API}/api/admin/settings/discount`),
        fetch(`${API}/api/products`)
      ])
      if (settingsRes.ok) {
        const data = await settingsRes.json()
        setGlobalDiscount(data.max_discount_allowed)
      }
      if (productsRes.ok) {
        const pData = await productsRes.json()
        setProducts(pData.products || pData)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const fetchLogs = async () => {
    setLoadingLogs(true)
    try {
      const res = await fetch(`${API}/api/admin/audit`)
      if (res.ok) {
        setLogs(await res.json())
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingLogs(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'analytics') fetchAnalytics()
    else if (activeTab === 'rules') fetchRulesData()
    else if (activeTab === 'audit') fetchLogs()
  }, [activeTab])

  const saveGlobalDiscount = async () => {
    setSavingGlobal(true)
    try {
      const res = await fetch(`${API}/api/admin/settings/discount`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ max_discount: globalDiscount })
      })
      if (res.ok) showToast("Global discount updated successfully!")
    } catch (err) {
      console.error(err)
    } finally {
      setSavingGlobal(false)
    }
  }

  const saveProductDiscount = async (product) => {
    setSavingProduct(product.id)
    try {
      const res = await fetch(`${API}/api/admin/products/${product.id}/discount`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ max_discount: product.max_discount || 0 })
      })
      if (res.ok) showToast(`Updated discount for ${product.name}`)
    } catch (err) {
      console.error(err)
    } finally {
      setSavingProduct(null)
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[var(--color-base)] text-[var(--color-cream)]">
      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 bg-green-900 border border-green-500 text-green-100 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-fade-in-down" style={{ fontFamily: 'var(--font-sans)' }}>
          <Check size={18} className="text-green-400" />
          {toast}
        </div>
      )}

      {/* Header & Tabs */}
      <div className="px-6 py-6 sm:px-8 border-b border-[var(--color-border)] bg-[var(--color-surface-alt)]">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2 font-serif" style={{ color: 'var(--color-cream)' }}>
          Merchant Dashboard
        </h1>
        <p className="text-sm italic mb-6" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-serif)' }}>
          Manage your autonomous agent, analyze negotiations, and configure rules.
        </p>

        <div className="flex gap-4 border-b border-[var(--color-border)]">
          <button 
            className={`pb-3 px-2 text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'analytics' ? 'border-b-2 border-[var(--color-gold)] text-[var(--color-gold-light)]' : 'text-[var(--color-text-dim)] hover:text-[var(--color-cream)]'}`}
            onClick={() => setActiveTab('analytics')}
          >
            <BarChart2 size={16} /> Analytics
          </button>
          <button 
            className={`pb-3 px-2 text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'rules' ? 'border-b-2 border-[var(--color-gold)] text-[var(--color-gold-light)]' : 'text-[var(--color-text-dim)] hover:text-[var(--color-cream)]'}`}
            onClick={() => setActiveTab('rules')}
          >
            <Settings size={16} /> Rule Engine
          </button>
          <button 
            className={`pb-3 px-2 text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'audit' ? 'border-b-2 border-[var(--color-gold)] text-[var(--color-gold-light)]' : 'text-[var(--color-text-dim)] hover:text-[var(--color-cream)]'}`}
            onClick={() => setActiveTab('audit')}
          >
            <Shield size={16} /> Audit Ledger
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto p-6 sm:p-8 noise-bg" style={{ background: 'var(--color-base)' }}>
        <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
          
          {/* TAB: ANALYTICS */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              {loadingAnalytics ? (
                <div className="animate-pulse flex gap-4">
                  {[1, 2, 3].map(i => <div key={i} className="h-32 bg-[var(--color-surface)] rounded-xl flex-1 border border-[var(--color-border)]"></div>)}
                </div>
              ) : analytics ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] p-5 rounded-xl shadow-card">
                      <div className="flex items-center gap-3 text-[var(--color-gold-dark)] mb-2">
                        <TrendingUp size={20} />
                        <h3 className="font-serif font-semibold">Total Revenue</h3>
                      </div>
                      <p className="text-3xl font-bold tracking-tight">₹{analytics.metrics.total_revenue.toFixed(2)}</p>
                    </div>
                    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] p-5 rounded-xl shadow-card">
                      <div className="flex items-center gap-3 text-blue-400 mb-2">
                        <LinkIcon size={20} />
                        <h3 className="font-serif font-semibold">Links Generated</h3>
                      </div>
                      <p className="text-3xl font-bold tracking-tight">{analytics.metrics.total_links_generated}</p>
                    </div>
                    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] p-5 rounded-xl shadow-card">
                      <div className="flex items-center gap-3 text-purple-400 mb-2">
                        <Percent size={20} />
                        <h3 className="font-serif font-semibold">Avg Discount</h3>
                      </div>
                      <p className="text-3xl font-bold tracking-tight">{analytics.metrics.average_discount_given.toFixed(1)}%</p>
                    </div>
                  </div>

                  <div className="bg-[var(--color-surface)] border border-[var(--color-border)] p-6 rounded-xl shadow-deep">
                    <h3 className="font-serif font-bold text-lg mb-6 flex items-center gap-2">
                      <BarChart2 size={18} className="text-[var(--color-gold)]" />
                      7-Day Revenue Trend
                    </h3>
                    <div className="h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={analytics.time_series} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                          <XAxis dataKey="date" stroke="rgba(255,255,255,0.4)" fontSize={12} tickLine={false} axisLine={false} />
                          <YAxis stroke="rgba(255,255,255,0.4)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v}`} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: 'var(--color-surface-alt)', border: '1px solid var(--color-border)', borderRadius: '8px' }}
                            itemStyle={{ color: 'var(--color-gold-light)' }}
                          />
                          <Line type="monotone" dataKey="revenue" stroke="var(--color-gold)" strokeWidth={3} dot={{ r: 4, fill: 'var(--color-gold-dark)' }} activeDot={{ r: 6 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </>
              ) : (
                <p>Failed to load analytics.</p>
              )}
            </div>
          )}

          {/* TAB: RULES ENGINE */}
          {activeTab === 'rules' && (
            <div className="space-y-8">
              
              {/* Global Settings */}
              <div className="bg-[var(--color-surface)] border border-[var(--color-border)] p-6 rounded-xl shadow-deep">
                <h3 className="font-serif font-bold text-lg mb-4 flex items-center gap-2">
                  <Settings size={18} className="text-[var(--color-gold)]" />
                  Global Agent Settings
                </h3>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-[var(--color-cream)] mb-1">Global Maximum Discount (%)</label>
                    <p className="text-xs text-[var(--color-text-dim)] mb-3">The absolute maximum discount the AI can negotiate up to by default.</p>
                    <input 
                      type="range" min="0" max="100" value={globalDiscount}
                      onChange={(e) => setGlobalDiscount(parseInt(e.target.value))}
                      className="w-full sm:max-w-xs accent-[var(--color-gold)]"
                    />
                    <div className="mt-2 text-[var(--color-gold-light)] font-bold text-xl">{globalDiscount}%</div>
                  </div>
                  <button 
                    onClick={saveGlobalDiscount}
                    disabled={savingGlobal}
                    className="px-6 py-2.5 rounded-lg text-sm font-bold bg-[var(--color-gold-dark)] text-[var(--color-cream)] hover:bg-copper transition-colors shadow-gold flex items-center gap-2"
                  >
                    <Save size={16} />
                    {savingGlobal ? 'Saving...' : 'Save Global Rule'}
                  </button>
                </div>
              </div>

              {/* Granular Rules */}
              <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-deep overflow-hidden">
                <div className="p-6 border-b border-[var(--color-border)] bg-[var(--color-surface-alt)]">
                  <h3 className="font-serif font-bold text-lg flex items-center gap-2">
                    <Shield size={18} className="text-[var(--color-gold)]" />
                    Granular Product Overrides
                  </h3>
                  <p className="text-xs text-[var(--color-text-dim)] mt-1">Set specific maximum discounts for individual products, overriding the global limit.</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-[var(--color-surface-alt)]/50 border-b border-[var(--color-border)]">
                      <tr>
                        <th className="px-6 py-3 font-serif font-medium text-[var(--color-text-dim)]">Product Name</th>
                        <th className="px-6 py-3 font-serif font-medium text-[var(--color-text-dim)]">Price</th>
                        <th className="px-6 py-3 font-serif font-medium text-[var(--color-text-dim)]">Max Discount Override (%)</th>
                        <th className="px-6 py-3 font-serif font-medium text-[var(--color-text-dim)] text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {products.map(p => (
                        <tr key={p.id} className="hover:bg-[var(--color-surface-alt)]/30 transition-colors">
                          <td className="px-6 py-4 font-medium text-[var(--color-cream)]">{p.name}</td>
                          <td className="px-6 py-4 text-[var(--color-text-muted)]">${p.price.toFixed(2)}</td>
                          <td className="px-6 py-4">
                            <input 
                              type="number" min="0" max="100" 
                              value={p.max_discount ?? ''}
                              placeholder="Use global"
                              onChange={(e) => {
                                const val = e.target.value === '' ? null : parseInt(e.target.value);
                                setProducts(products.map(prod => prod.id === p.id ? { ...prod, max_discount: val } : prod))
                              }}
                              className="bg-[var(--color-base)] border border-[var(--color-border)] rounded px-3 py-1.5 w-28 text-[var(--color-cream)] focus:border-[var(--color-gold)] focus:outline-none"
                            />
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button 
                              onClick={() => saveProductDiscount(p)}
                              disabled={savingProduct === p.id}
                              className="px-4 py-1.5 rounded-md text-xs font-semibold bg-[var(--color-surface-alt)] border border-[var(--color-border)] hover:border-[var(--color-gold)] hover:text-[var(--color-gold-light)] transition-colors"
                            >
                              {savingProduct === p.id ? 'Saving...' : 'Save'}
                            </button>
                          </td>
                        </tr>
                      ))}
                      {products.length === 0 && (
                        <tr>
                          <td colSpan="4" className="px-6 py-8 text-center text-[var(--color-text-dim)] italic">No products in catalog.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* TAB: AUDIT LEDGER */}
          {activeTab === 'audit' && (
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-deep overflow-hidden">
               <div className="overflow-x-auto">
                  <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                        {['ID', 'Timestamp', 'Action Taken', 'Reasoning'].map(h => (
                          <th key={h} className="px-4 sm:px-6 py-4 text-left text-xs uppercase tracking-widest font-medium whitespace-nowrap"
                            style={{ color: 'var(--color-text-dim)', fontFamily: 'var(--font-serif)' }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {logs.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-20 text-center">
                            <Shield className="w-12 h-12 mx-auto mb-3 text-[var(--color-text-dim)]" />
                            <p className="text-sm italic text-[var(--color-text-dim)] font-serif">
                              The ledger is empty &mdash; no agent actions recorded yet.
                            </p>
                          </td>
                        </tr>
                      ) : (
                        logs.map((log, i) => {
                          const actionStyle = getActionStyle(log.action_taken)
                          return (
                            <tr key={log.id}
                              className="transition-colors hover:bg-[var(--color-surface-alt)]/30"
                              style={{ borderBottom: '1px solid var(--color-border)' }}>
                              <td className="px-4 sm:px-6 py-4">
                                <span className="px-2.5 py-1 rounded-md text-xs tracking-wide bg-[var(--color-surface-alt)] border-[var(--color-border)] text-[var(--color-text-muted)]">
                                  #{log.id}
                                </span>
                              </td>
                              <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-xs tracking-wide text-[var(--color-text-muted)] font-serif">
                                {formatTimestamp(log.timestamp)}
                              </td>
                              <td className="px-4 sm:px-6 py-4">
                                <span className="inline-flex px-3 py-1 rounded-md text-xs font-medium uppercase tracking-widest whitespace-nowrap font-serif" style={actionStyle}>
                                  {log.action_taken}
                                </span>
                              </td>
                              <td className="px-4 sm:px-6 py-4 text-xs italic max-w-md leading-relaxed text-[var(--color-text-dim)] font-serif">
                                {log.ai_reasoning}
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
