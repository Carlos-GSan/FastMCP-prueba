import { useState, useEffect } from 'react'
import axios from 'axios'
import { Plus } from 'lucide-react'

const API_BASE = 'http://192.168.100.20:8001'

export default function ApiKeysManager() {
    const [keys, setKeys] = useState([])
    const [formData, setFormData] = useState({ name: '', key: '' })

    const [errorMsg, setErrorMsg] = useState('')

    useEffect(() => {
        fetchKeys()
    }, [])

    const fetchKeys = async () => {
        try {
            const res = await axios.get(`${API_BASE}/api_keys/`)
            setKeys(res.data)
        } catch (e) {
            console.error(e)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setErrorMsg('')
        try {
            await axios.post(`${API_BASE}/api_keys/`, formData)
            setFormData({ name: '', key: '' })
            fetchKeys()
        } catch (e) {
            setErrorMsg(e.response?.data?.detail || e.message)
            console.error(e)
        }
    }

    return (
        <div>
            <h1 className="page-title">API Keys Management</h1>

            <div className="panel">
                <form onSubmit={handleSubmit}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <input
                            placeholder="Name (e.g., Default Key)"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            required
                        />
                        <input
                            placeholder="API Key"
                            type="password"
                            value={formData.key}
                            onChange={e => setFormData({ ...formData, key: e.target.value })}
                            required
                        />
                    </div>
                    {errorMsg && (
                        <div style={{ color: '#ef4444', marginTop: '1rem', padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                            {errorMsg}
                        </div>
                    )}
                    <button type="submit" className="primary" style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Plus size={18} /> Register API Key and Discover Scopes
                    </button>
                </form>
            </div>

            <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
                <table>
                    <thead style={{ background: 'rgba(255,255,255,0.02)' }}>
                        <tr>
                            <th>ID</th>
                            <th>Name</th>
                            <th>Key</th>
                            <th>Allowed Scopes</th>
                        </tr>
                    </thead>
                    <tbody>
                        {keys.map(k => (
                            <tr key={k.id}>
                                <td>{k.id}</td>
                                <td>{k.name}</td>
                                <td>••••{k.key.slice(-4)}</td>
                                <td>
                                    <span style={{
                                        background: 'rgba(99, 102, 241, 0.2)',
                                        color: 'var(--accent-primary)',
                                        padding: '0.25rem 0.5rem',
                                        borderRadius: '4px',
                                        fontSize: '0.875rem'
                                    }}>{k.valid_scopes}</span>
                                </td>
                            </tr>
                        ))}
                        {keys.length === 0 && (
                            <tr>
                                <td colSpan="4" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                                    No API Keys configuring. Add one above.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
