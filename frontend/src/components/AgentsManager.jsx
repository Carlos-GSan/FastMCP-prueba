import { useState, useEffect } from 'react'
import axios from 'axios'
import { Plus, Key, Edit3, Save, X, Thermometer, Cpu } from 'lucide-react'

const API_BASE = 'http://127.0.0.1:8000'

const AVAILABLE_MODELS = [
    'o3-mini',
    'o1-mini',
    'o1',
    'o1-preview',
    'gpt-4.5-preview',
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4-turbo',
    'gpt-3.5-turbo',
]

export default function AgentsManager() {
    const [agents, setAgents] = useState([])
    const [keys, setKeys] = useState([])
    const [editingAgent, setEditingAgent] = useState(null) // agent id being edited
    const [editData, setEditData] = useState({})
    const [saving, setSaving] = useState(false)
    const [formData, setFormData] = useState({
        name: '',
        system_prompt: 'Eres un asistente útil que usará herramientas para cumplir la tarea.',
        selected_scopes: '',
        api_key_id: '',
        temperature: 0.0,
        model: 'gpt-4o'
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
                api_key_id: parseInt(formData.api_key_id),
                temperature: parseFloat(formData.temperature)
            })
            setFormData({
                name: '',
                system_prompt: 'Eres un asistente útil que usará herramientas para cumplir la tarea.',
                selected_scopes: '',
                api_key_id: keys.length > 0 ? keys[0].id : '',
                temperature: 0.0,
                model: 'gpt-4o'
            })
            fetchAgents()
        } catch (e) {
            console.error(e)
        }
    }

    const startEditing = (agent) => {
        setEditingAgent(agent.id)
        setEditData({
            name: agent.name,
            system_prompt: agent.system_prompt,
            selected_scopes: agent.selected_scopes,
            temperature: agent.temperature ?? 0.0,
            model: agent.model || 'gpt-4o',
        })
    }

    const cancelEditing = () => {
        setEditingAgent(null)
        setEditData({})
    }

    const saveEditing = async () => {
        setSaving(true)
        try {
            await axios.put(`${API_BASE}/agents/${editingAgent}`, {
                ...editData,
                temperature: parseFloat(editData.temperature)
            })
            setEditingAgent(null)
            setEditData({})
            fetchAgents()
        } catch (e) {
            console.error(e)
            alert('Error saving agent: ' + (e.response?.data?.detail || e.message))
        } finally {
            setSaving(false)
        }
    }

    const getAvailableScopes = (agentOrForm) => {
        const keyId = agentOrForm.api_key_id
        const keyObj = keys.find(k => k.id === parseInt(keyId))
        if (!keyObj || !keyObj.valid_scopes) return []
        return keyObj.valid_scopes.split(',').map(s => s.trim())
    }

    const ScopeCheckboxes = ({ availableScopes, selectedStr, onChange }) => {
        const current = selectedStr ? selectedStr.split(',').map(s => s.trim()) : []
        return (
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                {availableScopes.map(scope => (
                    <label key={scope} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                        <input
                            type="checkbox"
                            checked={current.includes(scope)}
                            onChange={(e) => {
                                let newSelected = [...current]
                                if (e.target.checked) {
                                    newSelected.push(scope)
                                } else {
                                    newSelected = newSelected.filter(s => s !== scope)
                                }
                                onChange(newSelected.join(', '))
                            }}
                            style={{ width: 'auto', marginBottom: 0 }}
                        />
                        <span style={{ color: 'var(--text-primary)' }}>{scope}</span>
                    </label>
                ))}
                {availableScopes.length === 0 && (
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        Select an API Key with scopes first.
                    </span>
                )}
            </div>
        )
    }

    return (
        <div>
            <h1 className="page-title">Agents Management</h1>

            {/* Create Form */}
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

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                                <Cpu size={14} style={{ verticalAlign: 'middle', marginRight: '0.3rem' }} />Model
                            </label>
                            <select
                                value={formData.model}
                                onChange={e => setFormData({ ...formData, model: e.target.value })}
                            >
                                {AVAILABLE_MODELS.map(m => (
                                    <option key={m} value={m}>{m}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                                <Thermometer size={14} style={{ verticalAlign: 'middle', marginRight: '0.3rem' }} />
                                Temperature: <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{formData.temperature}</span>
                            </label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>0</span>
                                <input
                                    type="range"
                                    min="0"
                                    max="2"
                                    step="0.1"
                                    value={formData.temperature}
                                    onChange={e => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
                                    style={{ flex: 1, accentColor: 'var(--accent-primary)' }}
                                />
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>2</span>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Select Scopes</label>
                        <div style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                            <ScopeCheckboxes
                                availableScopes={getAvailableScopes(formData)}
                                selectedStr={formData.selected_scopes}
                                onChange={val => setFormData({ ...formData, selected_scopes: val })}
                            />
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>System Prompt</label>
                        <textarea
                            placeholder="You are a helpful assistant..."
                            value={formData.system_prompt}
                            onChange={e => setFormData({ ...formData, system_prompt: e.target.value })}
                            required
                            rows={3}
                        />
                    </div>

                    <button type="submit" className="primary" style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Plus size={18} /> Create Agent
                    </button>
                </form>
            </div>

            {/* Agents Table */}
            <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
                <table>
                    <thead style={{ background: 'rgba(255,255,255,0.02)' }}>
                        <tr>
                            <th>ID</th>
                            <th>Name</th>
                            <th>Model</th>
                            <th>Temp</th>
                            <th>Scopes</th>
                            <th style={{ width: '60px' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {agents.map(a => (
                            <tr key={a.id}>
                                <td>{a.id}</td>
                                <td style={{ fontWeight: 500 }}>{a.name}</td>
                                <td>
                                    <span style={{
                                        background: 'rgba(99, 102, 241, 0.15)',
                                        color: '#a5b4fc',
                                        padding: '0.2rem 0.5rem',
                                        borderRadius: '4px',
                                        fontSize: '0.8rem',
                                        fontFamily: 'monospace'
                                    }}>{a.model || 'gpt-4o'}</span>
                                </td>
                                <td>
                                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                        {a.temperature ?? 0.0}
                                    </span>
                                </td>
                                <td>
                                    <span style={{
                                        background: 'rgba(99, 102, 241, 0.2)',
                                        color: 'var(--accent-primary)',
                                        padding: '0.25rem 0.5rem',
                                        borderRadius: '4px',
                                        fontSize: '0.8rem'
                                    }}>{a.selected_scopes}</span>
                                </td>
                                <td>
                                    <button
                                        onClick={() => startEditing(a)}
                                        title="Edit agent"
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            color: 'var(--accent-primary)',
                                            cursor: 'pointer',
                                            padding: '0.3rem',
                                            borderRadius: '4px',
                                        }}
                                    >
                                        <Edit3 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {agents.length === 0 && (
                            <tr>
                                <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                                    No Agents configured.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Edit Modal */}
            {editingAgent && (() => {
                const agent = agents.find(a => a.id === editingAgent)
                if (!agent) return null
                const availableScopes = getAvailableScopes(agent)

                return (
                    <div style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.6)',
                        backdropFilter: 'blur(4px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                    }}
                        onClick={(e) => { if (e.target === e.currentTarget) cancelEditing() }}
                    >
                        <div style={{
                            background: 'var(--bg-panel)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '12px',
                            padding: '1.5rem',
                            width: '90%',
                            maxWidth: '600px',
                            maxHeight: '85vh',
                            overflowY: 'auto',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1rem',
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h2 style={{ margin: 0, fontSize: '1.1rem' }}>
                                    <Edit3 size={18} style={{ verticalAlign: 'middle', marginRight: '0.5rem', color: 'var(--accent-primary)' }} />
                                    Edit Agent: {agent.name}
                                </h2>
                                <button
                                    onClick={cancelEditing}
                                    style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.25rem' }}
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Name */}
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Name</label>
                                <input
                                    value={editData.name}
                                    onChange={e => setEditData({ ...editData, name: e.target.value })}
                                />
                            </div>

                            {/* Model + Temperature */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                        <Cpu size={13} style={{ verticalAlign: 'middle', marginRight: '0.3rem' }} />Model
                                    </label>
                                    <select
                                        value={editData.model}
                                        onChange={e => setEditData({ ...editData, model: e.target.value })}
                                    >
                                        {AVAILABLE_MODELS.map(m => (
                                            <option key={m} value={m}>{m}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                        <Thermometer size={13} style={{ verticalAlign: 'middle', marginRight: '0.3rem' }} />
                                        Temperature: <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{editData.temperature}</span>
                                    </label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>0</span>
                                        <input
                                            type="range"
                                            min="0"
                                            max="2"
                                            step="0.1"
                                            value={editData.temperature}
                                            onChange={e => setEditData({ ...editData, temperature: parseFloat(e.target.value) })}
                                            style={{ flex: 1, accentColor: 'var(--accent-primary)' }}
                                        />
                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>2</span>
                                    </div>
                                </div>
                            </div>

                            {/* Scopes */}
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Scopes</label>
                                <div style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                                    <ScopeCheckboxes
                                        availableScopes={availableScopes}
                                        selectedStr={editData.selected_scopes}
                                        onChange={val => setEditData({ ...editData, selected_scopes: val })}
                                    />
                                </div>
                            </div>

                            {/* System Prompt */}
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>System Prompt</label>
                                <textarea
                                    value={editData.system_prompt}
                                    onChange={e => setEditData({ ...editData, system_prompt: e.target.value })}
                                    rows={5}
                                    style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                                />
                            </div>

                            {/* Actions */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                                <button
                                    onClick={cancelEditing}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '0.4rem',
                                        padding: '0.5rem 1rem',
                                        background: 'rgba(255,255,255,0.05)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '6px',
                                        color: 'var(--text-secondary)',
                                        cursor: 'pointer',
                                    }}
                                >
                                    <X size={16} /> Cancel
                                </button>
                                <button
                                    onClick={saveEditing}
                                    disabled={saving}
                                    className="primary"
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '0.4rem',
                                        padding: '0.5rem 1rem',
                                        opacity: saving ? 0.6 : 1,
                                    }}
                                >
                                    <Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            })()}
        </div>
    )
}
