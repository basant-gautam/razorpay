import { useState } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function CatalogManager() {
  const [file, setFile] = useState(null)
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleFileChange = (e) => {
    const selected = e.target.files[0]
    if (selected && selected.name.endsWith('.csv')) {
      setFile(selected)
      setStatus(null)
    } else if (selected) {
      setStatus({ type: 'error', text: 'Please select a .csv file' })
      setFile(null)
    }
  }

  const handleSync = async () => {
    if (!file) {
      setStatus({ type: 'error', text: 'Please select a CSV file first' })
      return
    }

    setLoading(true)
    setStatus(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch(`${API}/api/admin/upload-catalog`, {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()

      if (res.ok) {
        setStatus({ type: 'success', text: data.message || `${data.imported} products synced` })
        setFile(null)
      } else {
        setStatus({ type: 'error', text: data.detail || 'Upload failed' })
      }
    } catch {
      setStatus({ type: 'error', text: 'Cannot reach the Aegis server' })
    }
    setLoading(false)
  }

  const handleRemoveFile = () => {
    setFile(null)
    setStatus(null)
  }

  return (
    <div className="flex-1 overflow-auto p-4 sm:p-6 noise-bg" style={{ background: 'var(--color-base)' }}>
      <div className="max-w-2xl mx-auto" style={{ animation: 'fade-in 0.5s ease-out both' }}>
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-1" style={{ fontFamily: 'var(--font-serif)', color: 'var(--color-cream)' }}>
            Catalog Management
          </h1>
          <p className="text-sm italic" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-serif)' }}>
            Upload a CSV to sync your product inventory
          </p>
        </div>

        <div className="rounded-2xl p-8 sm:p-10 gradient-ornament-border"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-deep)' }}>

          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)' }}>
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--color-gold)' }} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-1" style={{ fontFamily: 'var(--font-serif)', color: 'var(--color-cream)' }}>
              Upload Product Catalog
            </h3>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              CSV format: <code style={{ color: 'var(--color-gold-dark)', background: 'var(--color-surface-alt)', padding: '2px 6px', borderRadius: '4px', fontFamily: 'var(--font-sans)' }}>name,price,stock</code>
            </p>
          </div>

          <label className="block w-full">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
              id="csv-upload"
            />
            <div
              className={`
                w-full rounded-xl border-2 border-dashed p-8 sm:p-10 text-center cursor-pointer
                transition-all duration-200 hover:scale-[1.01]
                ${file ? 'border-solid' : 'hover:border-opacity-70'}
              `}
              style={{
                borderColor: file ? 'var(--color-gold)' : 'var(--color-border)',
                background: file ? 'rgba(212, 168, 83, 0.04)' : 'var(--color-surface-alt)',
              }}
              onClick={() => document.getElementById('csv-upload').click()}
            >
              {file ? (
                <div className="space-y-2">
                  <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--color-gold)' }} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-sm font-medium" style={{ fontFamily: 'var(--font-serif)', color: 'var(--color-cream)' }}>
                    {file.name}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleRemoveFile() }}
                    className="text-xs underline transition-opacity hover:opacity-70"
                    style={{ color: 'var(--color-error)' }}
                  >
                    Remove file
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <svg className="w-10 h-10 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--color-text-dim)' }} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <p className="text-sm" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-serif)' }}>
                    Drag and drop your CSV here, or click to browse
                  </p>
                  <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>
                    Only .csv files are supported
                  </p>
                </div>
              )}
            </div>
          </label>

          <button
            onClick={handleSync}
            disabled={!file || loading}
            className="w-full mt-6 py-3.5 rounded-lg text-sm font-semibold transition-all duration-200 hover:scale-[1.02] tracking-wide gradient-ornament-border"
            style={{
              fontFamily: 'var(--font-serif)',
              background: 'linear-gradient(135deg, #2a1a3a, #1a1430)',
              color: 'var(--color-cream)',
              boxShadow: 'var(--shadow-gold)',
              letterSpacing: '0.04em',
              opacity: !file || loading ? 0.5 : 1,
              cursor: !file || loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Syncing...
              </span>
            ) : (
              'Sync Catalog'
            )}
          </button>

          {status && (
            <div
              className="mt-4 rounded-lg px-4 py-3 text-sm text-left"
              role="alert"
              style={{
                fontFamily: 'var(--font-sans)',
                background: status.type === 'success' ? 'var(--color-success-bg)' : 'var(--color-error-bg)',
                border: status.type === 'success' ? '1px solid var(--color-success-border)' : '1px solid var(--color-error-border)',
                color: status.type === 'success' ? 'var(--color-success)' : 'var(--color-error)',
              }}
            >
              {status.type === 'success' ? (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {status.text}
                </span>
              ) : (
                status.text
              )}
            </div>
          )}

          <div className="mt-8 p-4 rounded-lg" style={{ background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)' }}>
            <h4 className="text-xs uppercase tracking-widest font-medium mb-2" style={{ color: 'var(--color-text-dim)', fontFamily: 'var(--font-serif)' }}>
              Expected CSV Format
            </h4>
            <pre className="text-xs leading-relaxed overflow-x-auto" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-sans)' }}>
              name,price,stock{'\n'}
              Wireless Earbuds,2500,350{'\n'}
              Running Shoes,3000,500{'\n'}
              Coffee Mug,950,670
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CatalogManager
