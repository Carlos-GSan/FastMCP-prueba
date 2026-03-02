import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { Send, Bot, User, Loader2 } from 'lucide-react'

const API_BASE = 'http://192.168.100.20:8001'

export default function Chat() {
    const [agents, setAgents] = useState([])
    const [selectedAgent, setSelectedAgent] = useState('')
    const [messages, setMessages] = useState([])
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const messagesEndRef = useRef(null)

    useEffect(() => {
        fetchAgents()
    }, [])

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    const fetchAgents = async () => {
        try {
            const res = await axios.get(`${API_BASE}/agents/`)
            setAgents(res.data)
            if (res.data.length > 0) {
                setSelectedAgent(res.data[0].id)
            }
        } catch (e) { console.error(e) }
    }

    const handleSend = async (e) => {
        e.preventDefault()
        if (!input.trim() || !selectedAgent) return

        const userMsg = input.trim()
        setInput('')

        // Add user message to UI
        setMessages(prev => [...prev, { role: 'user', content: userMsg }])
        setIsLoading(true)

        try {
            const res = await axios.post(`${API_BASE}/chat/${selectedAgent}`, {
                message: userMsg
            })

            // Add agent response to UI
            setMessages(prev => [...prev, { role: 'agent', content: res.data.response }])
        } catch (e) {
            console.error(e)
            setMessages(prev => [...prev, {
                role: 'agent',
                content: `Sorry, an error occurred while connecting to the agent. Make sure the backend LLM is configured perfectly. Detail: ${e.response?.data?.detail || e.message}`
            }])
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h1 className="page-title" style={{ margin: 0 }}>Agent Chat</h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--bg-panel)', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Talk to:</span>
                    <select
                        value={selectedAgent}
                        onChange={e => {
                            setSelectedAgent(e.target.value)
                            setMessages([])
                        }}
                        style={{ margin: 0, padding: '0.25rem 0.5rem', background: 'transparent', border: 'none', color: 'var(--accent-primary)', fontWeight: 600, width: 'auto', minWidth: '150px' }}
                    >
                        {agents.map(a => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '1rem', marginBottom: 0 }}>
                <div className="chat-history">
                    {messages.length === 0 && (
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '100%',
                            color: 'var(--text-secondary)',
                            opacity: 0.5
                        }}>
                            <Bot size={64} style={{ marginBottom: '1rem' }} />
                            <p>Select an agent and start chatting.</p>
                            <p style={{ fontSize: '0.875rem' }}>They can use tools on your backend using the verified API key!</p>
                        </div>
                    )}
                    {messages.map((msg, i) => (
                        <div key={i} className={`message ${msg.role}`} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                            <div style={{
                                background: msg.role === 'user' ? 'rgba(0,0,0,0.2)' : 'rgba(99, 102, 241, 0.2)',
                                padding: '0.5rem',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                            }}>
                                {msg.role === 'user' ? <User size={16} /> : <Bot size={16} color="var(--accent-primary)" />}
                            </div>
                            <div style={{ lineHeight: '1.6', flex: 1 }}>
                                {msg.content}
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="message agent" style={{ display: 'flex', gap: '1rem', alignItems: 'center', background: 'transparent', border: 'none' }}>
                            <Loader2 size={18} className="spin" style={{ color: 'var(--accent-primary)' }} />
                            <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
                            <span style={{ color: 'var(--text-secondary)' }}>Agent is thinking and using tools...</span>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                <form className="chat-input" onSubmit={handleSend}>
                    <input
                        placeholder="Type a message to the agent... (e.g., Get users from database or Read logs)"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        disabled={!selectedAgent || isLoading}
                        autoFocus
                    />
                    <button
                        type="submit"
                        className="primary"
                        disabled={!selectedAgent || !input.trim() || isLoading}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 1.5rem', opacity: (!selectedAgent || !input.trim() || isLoading) ? 0.5 : 1 }}
                    >
                        <Send size={18} />
                    </button>
                </form>
            </div>
        </div>
    )
}
