import { useState, useEffect } from 'react'
import axios from 'axios'
import { MessageCircle, Bot, User, Zap, RefreshCw, Trash2, Smartphone } from 'lucide-react'

const API_BASE = 'http://127.0.0.1:8000'

export default function ConversationsViewer() {
    const [conversations, setConversations] = useState([])
    const [selectedId, setSelectedId] = useState(null)
    const [history, setHistory] = useState([])
    const [loadingList, setLoadingList] = useState(false)
    const [loadingChat, setLoadingChat] = useState(false)

    useEffect(() => {
        fetchConversations()
    }, [])

    useEffect(() => {
        if (selectedId) {
            fetchHistory(selectedId)
        } else {
            setHistory([])
        }
    }, [selectedId])

    const fetchConversations = async () => {
        setLoadingList(true)
        try {
            const res = await axios.get(`${API_BASE}/chat/conversations`)
            // Filter out empty or undefined just in case
            const valid = (res.data.conversations || []).filter(c => c && c.trim())
            
            // Sort to have the newest? the checkpointer doesn't give timestamps easily.
            // We just set them.
            setConversations(valid)
        } catch (e) {
            console.error(e)
        } finally {
            setLoadingList(false)
        }
    }

    const fetchHistory = async (id) => {
        setLoadingChat(true)
        try {
            const res = await axios.get(`${API_BASE}/chat/conversations/${encodeURIComponent(id)}`)
            setHistory(res.data.history || [])
        } catch (e) {
            console.error(e)
            setHistory([])
        } finally {
            setLoadingChat(false)
        }
    }

    const handleClear = async (id) => {
        if (!confirm(`¿Eliminar historial de ${id}?`)) return
        try {
            await axios.delete(`${API_BASE}/chat/conversations/${encodeURIComponent(id)}`)
            if (selectedId === id) {
                setSelectedId(null)
            }
            fetchConversations()
        } catch (e) {
            console.error(e)
            alert('Error clearing conversation')
        }
    }

    // Parses string like "twilio_2_+1415..." or returns plain string
    const formatName = (idStr) => {
        if (idStr.startsWith('twilio_')) return '📱 Twilio: ' + idStr.split('_').slice(2).join('_')
        if (idStr.startsWith('telegram_')) return '🤖 Telegram: ' + idStr.split('_').slice(2).join('_')
        if (idStr.startsWith('dashboard_')) return '💻 Dashboard: ' + idStr.split('_').slice(1).join('_')
        return idStr
    }

    return (
        <div style={{ display: 'flex', height: '100%', gap: '1rem' }}>
            {/* Sidebar list */}
            <div className="panel" style={{ width: '300px', display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden' }}>
                <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <MessageCircle size={18} /> Historial
                    </h3>
                    <button 
                        onClick={fetchConversations} 
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex' }}
                        title="Recargar"
                    >
                        <RefreshCw size={16} className={loadingList ? 'spin' : ''} />
                    </button>
                </div>
                
                <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
                    {conversations.length === 0 && !loadingList ? (
                        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '2rem' }}>
                            No hay conversaciones activas.
                        </p>
                    ) : (
                        conversations.map(conv => (
                            <div 
                                key={conv}
                                onClick={() => setSelectedId(conv)}
                                style={{
                                    padding: '0.75rem',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    background: selectedId === conv ? 'rgba(255,255,255,0.08)' : 'transparent',
                                    border: `1px solid ${selectedId === conv ? 'var(--border-color)' : 'transparent'}`,
                                    marginBottom: '0.25rem',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    transition: 'background 0.2s',
                                }}
                            >
                                <span style={{ fontSize: '0.85rem', wordBreak: 'break-all', opacity: 0.9 }}>
                                    {formatName(conv)}
                                </span>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleClear(conv) }}
                                    style={{
                                        background: 'transparent', border: 'none', color: 'var(--text-secondary)', 
                                        cursor: 'pointer', opacity: 0.5,
                                    }}
                                    onMouseOver={e => e.currentTarget.style.opacity = 1}
                                    onMouseOut={e => e.currentTarget.style.opacity = 0.5}
                                    title="Limpiar"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Main Chat Viewer */}
            <div className="panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {selectedId ? (
                    <>
                        <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)' }}>
                            <h3 style={{ margin: 0, fontSize: '1rem', opacity: 0.8 }}>
                                Conversación: <span style={{ fontFamily: 'monospace', color: 'var(--accent-primary)' }}>{selectedId}</span>
                            </h3>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {loadingChat ? (
                                <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Cargando mensajes...</p>
                            ) : history.length === 0 ? (
                                <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Esta conversación no tiene mensajes o fue eliminada.</p>
                            ) : (
                                history.map((msg, i) => (
                                    <div 
                                        key={i} 
                                        style={{ 
                                            display: 'flex', 
                                            flexDirection: 'column',
                                            alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' 
                                        }}
                                    >
                                        <div style={{
                                            maxWidth: '80%',
                                            padding: '0.75rem 1rem',
                                            borderRadius: '12px',
                                            borderBottomRightRadius: msg.role === 'user' ? '2px' : '12px',
                                            borderBottomLeftRadius: msg.role === 'agent' ? '2px' : '12px',
                                            background: msg.role === 'user' ? 'var(--accent-primary)' : 'rgba(255,255,255,0.05)',
                                            border: msg.role !== 'user' ? '1px solid var(--border-color)' : 'none',
                                            color: '#fff',
                                            fontSize: '0.9rem',
                                            lineHeight: '1.4',
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem', fontSize: '0.75rem', opacity: 0.7 }}>
                                                {msg.role === 'user' ? <Smartphone size={12} /> : <Bot size={12} />}
                                                {msg.role === 'user' ? 'Usuario' : msg.role === 'agent' ? 'Agente' : msg.role.toUpperCase()}
                                            </div>
                                            {/* Si es tool vemos distinto */}
                                            {msg.role === 'tool' ? (
                                                <pre style={{ margin: 0, padding: '0.5rem', background: 'rgba(0,0,0,0.5)', borderRadius: '4px', fontSize: '0.8rem', overflowX: 'auto' }}>
                                                    Tool: {msg.name}
                                                    {'\n'}{msg.content}
                                                </pre>
                                            ) : (
                                                <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </>
                ) : (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                        <MessageCircle size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                        <p>Selecciona una conversación a la izquierda para ver su historial.</p>
                    </div>
                )}
            </div>
        </div>
    )
}
