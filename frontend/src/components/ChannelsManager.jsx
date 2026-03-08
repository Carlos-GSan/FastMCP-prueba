import { useState, useEffect } from 'react'
import axios from 'axios'
import { Plus, Radio, Trash2, Power, PowerOff, Edit3, Save, X, Bot, Send } from 'lucide-react'

const API_BASE = 'http://127.0.0.1:8001'

const CHANNEL_TYPES = [
    { value: 'telegram', label: 'Telegram', icon: '🤖', color: '#2AABEE' },
    { value: 'twilio', label: 'Twilio (SMS/WhatsApp)', icon: '📱', color: '#F22F46' },
]

export default function ChannelsManager() {
    const [channels, setChannels] = useState([])
    const [agents, setAgents] = useState([])
    const [showForm, setShowForm] = useState(false)
    const [editingChannel, setEditingChannel] = useState(null)
    const [editData, setEditData] = useState({})
    const [saving, setSaving] = useState(false)
    const [formData, setFormData] = useState({
        type: 'telegram',
        agent_id: '',
        bot_token: '',
        account_sid: '',
        auth_token: '',
        phone_number: '',
    })

    useEffect(() => {
        fetchChannels()
        fetchAgents()
    }, [])

    const fetchChannels = async () => {
        try {
            const res = await axios.get(`${API_BASE}/channels/`)
            setChannels(res.data)
        } catch (e) { console.error(e) }
    }

    const fetchAgents = async () => {
        try {
            const res = await axios.get(`${API_BASE}/agents/`)
            setAgents(res.data)
            if (res.data.length > 0) {
                setFormData(prev => ({ ...prev, agent_id: res.data[0].id }))
            }
        } catch (e) { console.error(e) }
    }

    const buildConfig = (data) => {
        if (data.type === 'telegram') {
            return JSON.stringify({ bot_token: data.bot_token })
        } else {
            return JSON.stringify({
                account_sid: data.account_sid,
                auth_token: data.auth_token,
                phone_number: data.phone_number,
            })
        }
    }

    const parseConfig = (configStr) => {
        try { return JSON.parse(configStr) }
        catch { return {} }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setSaving(true)
        try {
            await axios.post(`${API_BASE}/channels/`, {
                type: formData.type,
                agent_id: parseInt(formData.agent_id),
                config: buildConfig(formData),
            })
            setFormData({
                type: 'telegram',
                agent_id: agents.length > 0 ? agents[0].id : '',
                bot_token: '',
                account_sid: '',
                auth_token: '',
                phone_number: '',
            })
            setShowForm(false)
            fetchChannels()
        } catch (e) {
            console.error(e)
            alert('Error creating channel: ' + (e.response?.data?.detail || e.message))
        } finally {
            setSaving(false)
        }
    }

    const handleToggle = async (id) => {
        try {
            await axios.post(`${API_BASE}/channels/${id}/toggle`)
            fetchChannels()
        } catch (e) {
            console.error(e)
            alert('Error toggling channel: ' + (e.response?.data?.detail || e.message))
        }
    }

    const handleDelete = async (id) => {
        if (!confirm('¿Eliminar este canal?')) return
        try {
            await axios.delete(`${API_BASE}/channels/${id}`)
            fetchChannels()
        } catch (e) {
            console.error(e)
            alert('Error deleting channel: ' + (e.response?.data?.detail || e.message))
        }
    }

    const startEditing = (channel) => {
        const config = parseConfig(channel.config)
        setEditingChannel(channel.id)
        setEditData({
            agent_id: channel.agent_id,
            ...(channel.type === 'telegram'
                ? { bot_token: config.bot_token || '' }
                : {
                    account_sid: config.account_sid || '',
                    auth_token: config.auth_token || '',
                    phone_number: config.phone_number || '',
                }),
            type: channel.type,
        })
    }

    const saveEditing = async () => {
        setSaving(true)
        try {
            const config = editData.type === 'telegram'
                ? JSON.stringify({ bot_token: editData.bot_token })
                : JSON.stringify({
                    account_sid: editData.account_sid,
                    auth_token: editData.auth_token,
                    phone_number: editData.phone_number,
                })

            await axios.put(`${API_BASE}/channels/${editingChannel}`, {
                agent_id: parseInt(editData.agent_id),
                config,
            })
            setEditingChannel(null)
            setEditData({})
            fetchChannels()
        } catch (e) {
            console.error(e)
            alert('Error updating channel: ' + (e.response?.data?.detail || e.message))
        } finally {
            setSaving(false)
        }
    }

    const getAgentName = (agentId) => {
        const agent = agents.find(a => a.id === agentId)
        return agent ? agent.name : `Agent #${agentId}`
    }

    const getTypeInfo = (type) => {
        return CHANNEL_TYPES.find(t => t.value === type) || CHANNEL_TYPES[0]
    }

    const maskToken = (token) => {
        if (!token || token.length < 10) return '••••••••'
        return token.slice(0, 6) + '••••' + token.slice(-4)
    }

    return (
        <div>
            <h1 className="page-title">Channels</h1>

            {/* Header with add button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                    Conecta tus agentes a Telegram, WhatsApp o SMS.
                </p>
                <button
                    className="primary"
                    onClick={() => setShowForm(!showForm)}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                    {showForm ? <X size={18} /> : <Plus size={18} />}
                    {showForm ? 'Cancel' : 'New Channel'}
                </button>
            </div>

            {/* Create Form */}
            {showForm && (
                <div className="panel" style={{ animation: 'fadeIn 0.3s ease-out' }}>
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                                    Channel Type
                                </label>
                                <div style={{ display: 'flex', gap: '0.75rem' }}>
                                    {CHANNEL_TYPES.map(ct => (
                                        <button
                                            key={ct.value}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, type: ct.value })}
                                            style={{
                                                flex: 1,
                                                padding: '0.75rem',
                                                borderRadius: '8px',
                                                border: formData.type === ct.value
                                                    ? `2px solid ${ct.color}`
                                                    : '1px solid var(--border-color)',
                                                background: formData.type === ct.value
                                                    ? `${ct.color}15`
                                                    : 'rgba(255,255,255,0.03)',
                                                color: 'var(--text-primary)',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.5rem',
                                                fontSize: '0.9rem',
                                                fontWeight: formData.type === ct.value ? 600 : 400,
                                                transition: 'all 0.2s ease',
                                            }}
                                        >
                                            <span style={{ fontSize: '1.2rem' }}>{ct.icon}</span>
                                            {ct.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                                    <Bot size={14} style={{ verticalAlign: 'middle', marginRight: '0.3rem' }} />
                                    Assign Agent
                                </label>
                                <select
                                    value={formData.agent_id}
                                    onChange={e => setFormData({ ...formData, agent_id: e.target.value })}
                                    required
                                >
                                    <option value="" disabled>Select Agent</option>
                                    {agents.map(a => (
                                        <option key={a.id} value={a.id}>{a.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Telegram Config */}
                        {formData.type === 'telegram' && (
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                                    Bot Token <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>(from @BotFather)</span>
                                </label>
                                <input
                                    type="password"
                                    placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                                    value={formData.bot_token}
                                    onChange={e => setFormData({ ...formData, bot_token: e.target.value })}
                                    required
                                />
                            </div>
                        )}

                        {/* Twilio Config */}
                        {formData.type === 'twilio' && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                                        Account SID
                                    </label>
                                    <input
                                        type="password"
                                        placeholder="AC..."
                                        value={formData.account_sid}
                                        onChange={e => setFormData({ ...formData, account_sid: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                                        Auth Token
                                    </label>
                                    <input
                                        type="password"
                                        placeholder="your_auth_token"
                                        value={formData.auth_token}
                                        onChange={e => setFormData({ ...formData, auth_token: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                                        Phone Number
                                    </label>
                                    <input
                                        placeholder="+1234567890"
                                        value={formData.phone_number}
                                        onChange={e => setFormData({ ...formData, phone_number: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>
                        )}

                        <button type="submit" className="primary" disabled={saving} style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: saving ? 0.6 : 1 }}>
                            <Send size={16} /> {saving ? 'Creating...' : 'Create Channel'}
                        </button>
                    </form>
                </div>
            )}

            {/* Channels List */}
            {channels.length === 0 ? (
                <div className="panel" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                    <Radio size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                    <p>No channels configured yet.</p>
                    <p style={{ fontSize: '0.85rem' }}>Click "New Channel" to connect an agent to Telegram or Twilio.</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gap: '1rem' }}>
                    {channels.map(ch => {
                        const typeInfo = getTypeInfo(ch.type)
                        const config = parseConfig(ch.config)
                        return (
                            <div
                                key={ch.id}
                                className="panel"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '1.25rem',
                                    padding: '1.25rem 1.5rem',
                                    opacity: ch.enabled ? 1 : 0.6,
                                    transition: 'opacity 0.3s ease',
                                }}
                            >
                                {/* Type badge */}
                                <div style={{
                                    fontSize: '1.8rem',
                                    width: '48px',
                                    height: '48px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: '12px',
                                    background: `${typeInfo.color}15`,
                                    border: `1px solid ${typeInfo.color}30`,
                                    flexShrink: 0,
                                }}>
                                    {typeInfo.icon}
                                </div>

                                {/* Info */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                                        <span style={{ fontWeight: 600, fontSize: '1rem' }}>{typeInfo.label}</span>
                                        <span style={{
                                            padding: '0.15rem 0.5rem',
                                            borderRadius: '999px',
                                            fontSize: '0.7rem',
                                            fontWeight: 600,
                                            background: ch.enabled ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                            color: ch.enabled ? '#22c55e' : '#ef4444',
                                        }}>
                                            {ch.enabled ? 'ACTIVE' : 'DISABLED'}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                        <span>
                                            <Bot size={12} style={{ verticalAlign: 'middle', marginRight: '0.25rem' }} />
                                            {getAgentName(ch.agent_id)}
                                        </span>
                                        {ch.type === 'telegram' && config.bot_token && (
                                            <span style={{ fontFamily: 'monospace' }}>Token: {maskToken(config.bot_token)}</span>
                                        )}
                                        {ch.type === 'twilio' && config.phone_number && (
                                            <span>📞 {config.phone_number}</span>
                                        )}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                                    <button
                                        onClick={() => startEditing(ch)}
                                        title="Edit"
                                        style={{
                                            background: 'rgba(255,255,255,0.05)',
                                            border: '1px solid var(--border-color)',
                                            color: 'var(--accent-primary)',
                                            padding: '0.4rem',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            transition: 'all 0.2s ease',
                                        }}
                                    >
                                        <Edit3 size={15} />
                                    </button>
                                    <button
                                        onClick={() => handleToggle(ch.id)}
                                        title={ch.enabled ? 'Disable' : 'Enable'}
                                        style={{
                                            background: ch.enabled ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                                            border: `1px solid ${ch.enabled ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)'}`,
                                            color: ch.enabled ? '#ef4444' : '#22c55e',
                                            padding: '0.4rem',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            transition: 'all 0.2s ease',
                                        }}
                                    >
                                        {ch.enabled ? <PowerOff size={15} /> : <Power size={15} />}
                                    </button>
                                    <button
                                        onClick={() => handleDelete(ch.id)}
                                        title="Delete"
                                        style={{
                                            background: 'rgba(239, 68, 68, 0.1)',
                                            border: '1px solid rgba(239, 68, 68, 0.3)',
                                            color: '#ef4444',
                                            padding: '0.4rem',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            transition: 'all 0.2s ease',
                                        }}
                                    >
                                        <Trash2 size={15} />
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Edit Modal */}
            {editingChannel && (() => {
                const channel = channels.find(c => c.id === editingChannel)
                if (!channel) return null

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
                        onClick={(e) => { if (e.target === e.currentTarget) setEditingChannel(null) }}
                    >
                        <div style={{
                            background: 'var(--bg-panel)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '12px',
                            padding: '1.5rem',
                            width: '90%',
                            maxWidth: '500px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1rem',
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h2 style={{ margin: 0, fontSize: '1.1rem' }}>
                                    <Edit3 size={18} style={{ verticalAlign: 'middle', marginRight: '0.5rem', color: 'var(--accent-primary)' }} />
                                    Edit Channel
                                </h2>
                                <button
                                    onClick={() => setEditingChannel(null)}
                                    style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.25rem' }}
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Agent */}
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                    <Bot size={13} style={{ verticalAlign: 'middle', marginRight: '0.3rem' }} />Agent
                                </label>
                                <select
                                    value={editData.agent_id}
                                    onChange={e => setEditData({ ...editData, agent_id: e.target.value })}
                                >
                                    {agents.map(a => (
                                        <option key={a.id} value={a.id}>{a.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Telegram fields */}
                            {editData.type === 'telegram' && (
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Bot Token</label>
                                    <input
                                        type="password"
                                        value={editData.bot_token}
                                        onChange={e => setEditData({ ...editData, bot_token: e.target.value })}
                                    />
                                </div>
                            )}

                            {/* Twilio fields */}
                            {editData.type === 'twilio' && (
                                <>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Account SID</label>
                                        <input
                                            type="password"
                                            value={editData.account_sid}
                                            onChange={e => setEditData({ ...editData, account_sid: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Auth Token</label>
                                        <input
                                            type="password"
                                            value={editData.auth_token}
                                            onChange={e => setEditData({ ...editData, auth_token: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Phone Number</label>
                                        <input
                                            value={editData.phone_number}
                                            onChange={e => setEditData({ ...editData, phone_number: e.target.value })}
                                        />
                                    </div>
                                </>
                            )}

                            {/* Actions */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                                <button
                                    onClick={() => setEditingChannel(null)}
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
