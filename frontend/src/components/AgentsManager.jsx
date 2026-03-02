import { useState, useEffect } from 'react'
import axios from 'axios'
import { Plus, Key } from 'lucide-react'

const API_BASE = 'http://192.168.100.20:8001'

export default function AgentsManager() {
    const [agents, setAgents] = useState([])
    const [keys, setKeys] = useState([])
    const [formData, setFormData] = useState({
        name: '',
        system_prompt: 'Eres un asistente útil que usará herramientas para cumplir la tarea.',
        selected_scopes: '',
        api_key_id: ''
    })

    useEffect(() => {
        fetchAgents()
        fetchKeys()
    }, [])

    const fetchAgents = async () => {
        try {
            const res = await axios.get(`${API_BASE}/agents/`)
            setAgents(res.data)
        } catch (e) { console.error(e) }
    }

    const fetchKeys = async () => {
        try {
            const res = await axios.get(`${API_BASE}/api_keys/`)
            setKeys(res.data)
            if (res.data.length > 0) {
                setFormData(prev => ({ ...prev, api_key_id: res.data[0].id }))
            }
        } catch (e) { console.error(e) }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            await axios.post(`${API_BASE}/agents/`, {
                ...formData,
                api_key_id: parseInt(formData.api_key_id)
            })
            setFormData({
                name: '',
                system_prompt: 'Eres un asistente útil que usará herramientas para cumplir la tarea.',
                selected_scopes: '',
                api_key_id: keys.length > 0 ? keys[0].id : ''
            })
            fetchAgents()
        } catch (e) {
            console.error(e)
        }
    }

    return (
        <div>
            <h1 className="page-title">Agents Management</h1>

            <div className="panel">
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Agent Name</label>
                            <input
                                placeholder="Name (e.g., Database Support)"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                required
                            />
                        </div>

                        <div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Attach API Key</label>
                                <select
                                    value={formData.api_key_id}
                                    onChange={e => {
                                        const newKeyId = e.target.value;
                                        // If key changes, reset selected scopes
                                        setFormData({ ...formData, api_key_id: newKeyId, selected_scopes: '' })
                                    }}
                                    required
                                >
                                    <option value="" disabled>Select API Key</option>
                                    {keys.map(k => (
                                        <option key={k.id} value={k.id}>{k.name} ({k.valid_scopes})</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Select Scopes</label>
                            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', padding: '1rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                                {(() => {
                                    const selectedKeyObj = keys.find(k => k.id === parseInt(formData.api_key_id));
                                    if (!selectedKeyObj || !selectedKeyObj.valid_scopes) {
                                        return <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Please select an API Key with discovered scopes first.</div>;
                                    }
                                    const availableScopes = selectedKeyObj.valid_scopes.split(',').map(s => s.trim());
                                    return availableScopes.map(scope => {
                                        const currentSelected = formData.selected_scopes ? formData.selected_scopes.split(',').map(s => s.trim()) : [];
                                        const isChecked = currentSelected.includes(scope);
                                        return (
                                            <label key={scope} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={(e) => {
                                                        let newSelected = [...currentSelected];
                                                        if (e.target.checked) {
                                                            newSelected.push(scope);
                                                        } else {
                                                            newSelected = newSelected.filter(s => s !== scope);
                                                        }
                                                        setFormData({ ...formData, selected_scopes: newSelected.join(', ') });
                                                    }}
                                                    style={{ width: 'auto', marginBottom: 0 }}
                                                />
                                                {scope}
                                            </label>
                                        );
                                    });
                                })()}
                            </div>
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>System Prompt</label>
                        <textarea
                            placeholder="You are a helpful assistant..."
                            value={formData.system_prompt}
                            onChange={e => setFormData({ ...formData, system_prompt: e.target.value })}
                            required
                            rows={4}
                        />
                    </div>

                    <button type="submit" className="primary" style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Plus size={18} /> Create Agent
                    </button>
                </form>
            </div>

            <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
                <table>
                    <thead style={{ background: 'rgba(255,255,255,0.02)' }}>
                        <tr>
                            <th>ID</th>
                            <th>Name</th>
                            <th>Scopes</th>
                            <th>API Key ID</th>
                        </tr>
                    </thead>
                    <tbody>
                        {agents.map(a => (
                            <tr key={a.id}>
                                <td>{a.id}</td>
                                <td style={{ fontWeight: 500 }}>{a.name}</td>
                                <td>
                                    <span style={{
                                        background: 'rgba(99, 102, 241, 0.2)',
                                        color: 'var(--accent-primary)',
                                        padding: '0.25rem 0.5rem',
                                        borderRadius: '4px',
                                        fontSize: '0.875rem'
                                    }}>{a.selected_scopes}</span>
                                </td>
                                <td><Key size={14} style={{ marginRight: '4px', verticalAlign: 'middle', color: 'var(--text-secondary)' }} /> {a.api_key_id}</td>
                            </tr>
                        ))}
                        {agents.length === 0 && (
                            <tr>
                                <td colSpan="4" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                                    No Agents configured.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
