import { useState, useEffect } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function OrdersView({ user }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  if (!user || !user.token) return <div className="p-8 text-center text-sm" style={{color:'var(--color-text-muted)'}}>Please sign in again</div>
  const isMerchant = user.role === 'merchant'
  const endpoint = isMerchant ? `${API}/api/admin/orders` : `${API}/api/orders/${user.username}`

  const fetchOrders = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(endpoint, { headers: { Authorization: `Bearer ${user.token}` } })
      if (!res.ok) throw new Error((await res.json()).detail || 'Failed')
      const data = await res.json()
      setOrders(data.orders || [])
    } catch (e) { setError(e.message || 'Load failed') }
    setLoading(false)
  }

  const verify = async (id) => {
    try {
      const res = await fetch(`${API}/api/payment-links/${id}/verify`, { method: 'POST', headers: { Authorization: `Bearer ${user.token}` } })
      const data = await res.json()
      if (data.status === 'paid') fetchOrders()
      else alert(data.message || 'Still pending - complete payment then verify again')
    } catch { alert('Verify failed') }
  }

  const download = async (id, inv) => {
    const res = await fetch(`${API}/api/payment-links/${id}/invoice/download`, { headers: { Authorization: `Bearer ${user.token}` } })
    if (!res.ok) { alert('Invoice not ready - payment pending'); return }
    const blob = await res.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${inv || id}.pdf`
    document.body.appendChild(a); a.click(); a.remove()
  }

  useEffect(() => { fetchOrders() }, [])

  if (loading) return <div className="p-8 text-center text-sm" style={{color:'var(--color-text-muted)'}}>Loading orders...</div>
  if (error) return <div className="p-8 text-center text-sm text-red-400">{error} <button onClick={fetchOrders} className="underline ml-2">Retry</button></div>
  if (orders.length===0) return <div className="p-12 text-center"><p className="text-sm italic" style={{color:'var(--color-text-muted)'}}>No orders yet - purchase a product to see invoice here</p></div>

  return (
    <div className="p-4 sm:p-6 space-y-3">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-serif font-bold" style={{color:'var(--color-cream)'}}>{isMerchant ? 'All Orders (Buyer + Invoice)' : 'My Orders & Invoices'}</h3>
        <button onClick={fetchOrders} className="text-xs px-3 py-1.5 rounded border" style={{borderColor:'var(--color-border)', color:'var(--color-text-muted)'}}>Refresh</button>
      </div>
      <div className="overflow-x-auto rounded-xl border" style={{borderColor:'var(--color-border)'}}>
        <table className="w-full text-sm">
          <thead style={{background:'var(--color-surface-alt)'}}>
            <tr className="text-xs uppercase tracking-widest" style={{color:'var(--color-text-dim)'}}>
              {isMerchant && <th className="px-4 py-3 text-left">Buyer</th>}
              <th className="px-4 py-3 text-left">Product</th>
              <th className="px-4 py-3 text-left">Amount</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Invoice</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {orders.map(o=>(
              <tr key={o.payment_link_id} className="border-t" style={{borderColor:'var(--color-border)'}}>
                {isMerchant && <td className="px-4 py-3">{o.buyer_username || '-'}</td>}
                <td className="px-4 py-3">{o.product_name}</td>
                <td className="px-4 py-3">₹{o.amount}</td>
                <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-xs ${o.status==='paid'?'bg-green-900 text-green-200':'bg-yellow-900 text-yellow-200'}`}>{o.status}</span></td>
                <td className="px-4 py-3 text-xs">{o.invoice_number || (o.status==='paid' ? 'Generating...' : '-')}</td>
                <td className="px-4 py-3 text-right flex gap-2 justify-end">
                  {o.status!=='paid' && <button onClick={()=>verify(o.payment_link_id)} className="px-3 py-1 rounded text-xs" style={{background:'var(--color-gold-dark)', color:'var(--color-cream)'}}>Verify Payment</button>}
                  {o.status==='paid' && <button onClick={()=>download(o.payment_link_id, o.invoice_number)} className="px-3 py-1 rounded text-xs border" style={{borderColor:'var(--color-gold)'}}>Download PDF</button>}
                  <a href={o.short_url} target="_blank" rel="noreferrer" className="px-3 py-1 rounded text-xs border" style={{borderColor:'var(--color-border)'}}>Pay Link</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs italic" style={{color:'var(--color-text-dim)'}}>Tip: Payment ke baad "Verify Payment" dabao - Razorpay se status check hoke dashboard + AI dono update ho jayenge, invoice buyer or merchant dono ko dikhega.</p>
    </div>
  )
}
