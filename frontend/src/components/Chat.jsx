import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Send, Bot, User, Loader2, RefreshCw, ChevronDown, ChevronUp, Clock, Cpu, Wrench, AlertTriangle } from 'lucide-react'

const API_BASE = 'http://127.0.0.1:8000'

function MetricsPanel({ metrics }) {
    const [isOpen, setIsOpen] = useState(false)

    if (!metrics) return null

    const { prompt_tokens, completion_tokens, total_tokens, llm_calls, duration_seconds, tools_used, errors } = metrics

    return (
        <div style={{ marginTop: '0.5rem' }}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.25rem 0.6rem',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '6px',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    transition: 'all 0.2s ease',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
            >
                <Cpu size={12} />
                {total_tokens} tokens · {duration_seconds}s
                {tools_used?.length > 0 && ` · ${tools_used.length} tool${tools_used.length > 1 ? 's' : ''}`}
                {errors?.length > 0 && <AlertTriangle size={12} color="#ef4444" />}
                {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>

            {isOpen && (
                <div style={{
                    marginTop: '0.5rem',
                    padding: '0.75rem',
                    background: 'rgba(0,0,0,0.3)',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.08)',
                    fontSize: '0.8rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.6rem',
                }}>
                    {/* Token usage */}
                    <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--text-secondary)' }}>
                            <Cpu size={13} color="var(--accent-primary)" />
                            <span style={{ color: '#a5b4fc', fontWeight: 600 }}>{total_tokens}</span> total tokens
                        </div>
                        <div style={{ color: 'var(--text-secondary)' }}>
                            📥 {prompt_tokens} prompt
                        </div>
                        <div style={{ color: 'var(--text-secondary)' }}>
                            📤 {completion_tokens} completion
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--text-secondary)' }}>
                            <Clock size={13} color="var(--accent-primary)" />
                            {duration_seconds}s · {llm_calls} LLM call{llm_calls !== 1 ? 's' : ''}
                        </div>
                    </div>

                    {/* Tools used */}
                    {tools_used?.length > 0 && (
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                                <Wrench size={13} color="var(--accent-primary)" />
                                <strong>Tools used:</strong>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginLeft: '1rem' }}>
                                {tools_used.map((tool, i) => (
                                    <div key={i} style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '0.25rem',
                                        padding: '0.4rem 0.5rem',
                                        background: tool.status === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(99, 102, 241, 0.08)',
                                        borderRadius: '4px',
                                        border: `1px solid ${tool.status === 'error' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(99, 102, 241, 0.15)'}`,
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                            <span>{tool.status === 'error' ? '❌' : '✅'}</span>
                                            <span style={{ color: '#c7d2fe', fontWeight: 500, fontFamily: 'monospace', fontSize: '0.78rem' }}>{tool.name}</span>
                                        </div>
                                        {tool.payload && Object.keys(tool.payload).length > 0 && (
                                            <div style={{
                                                padding: '0.3rem 0.5rem',
                                                background: 'rgba(0,0,0,0.25)',
                                                borderRadius: '3px',
                                                fontSize: '0.72rem',
                                                fontFamily: 'monospace',
                                                color: '#94a3b8',
                                                whiteSpace: 'pre-wrap',
                                                wordBreak: 'break-word',
                                                maxHeight: '120px',
                                                overflowY: 'auto',
                                            }}>
                                                <span style={{ color: '#818cf8', fontWeight: 600 }}>payload: </span>
                                                {JSON.stringify(tool.payload, null, 2)}
                                            </div>
                                        )}
                                        {tool.result_preview && (
                                            <div style={{
                                                color: 'var(--text-secondary)',
                                                fontSize: '0.72rem',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                maxWidth: '500px',
                                            }}>
                                                → {tool.result_preview}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Errors */}
                    {errors?.length > 0 && (
                        <div style={{
                            padding: '0.5rem',
                            background: 'rgba(239, 68, 68, 0.1)',
                            borderRadius: '6px',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#ef4444', fontWeight: 600, marginBottom: '0.3rem' }}>
                                <AlertTriangle size={13} /> Errors
                            </div>
                            {errors.map((err, i) => (
                                <div key={i} style={{ color: '#fca5a5', fontSize: '0.75rem' }}>{err}</div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

export default function Chat() {
    const [agents, setAgents] = useState([])
    const [selectedAgent, setSelectedAgent] = useState('')
    const [messages, setMessages] = useState([])
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [conversationId, setConversationId] = useState(crypto.randomUUID())
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

    const handleNewChat = () => {
        setMessages([])
        setConversationId(crypto.randomUUID())
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
                message: userMsg,
                conversation_id: conversationId
            })

            // Add agent response with metrics to UI
            setMessages(prev => [...prev, {
                role: 'agent',
                content: res.data.response,
                metrics: res.data.metrics
            }])
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
                            setConversationId(crypto.randomUUID())
                        }}
                        style={{ margin: 0, padding: '0.25rem 0.5rem', background: 'transparent', border: 'none', color: 'var(--accent-primary)', fontWeight: 600, width: 'auto', minWidth: '150px' }}
                    >
                        {agents.map(a => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                    </select>
                    <button
                        onClick={handleNewChat}
                        title="Nueva conversación"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            padding: '0.35rem 0.75rem',
                            background: 'rgba(99, 102, 241, 0.15)',
                            border: '1px solid rgba(99, 102, 241, 0.3)',
                            borderRadius: '6px',
                            color: 'var(--accent-primary)',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            fontWeight: 500,
                            transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.25)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.15)'}
                    >
                        <RefreshCw size={14} />
                        New Chat
                    </button>
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
                            <div className="markdown-body" style={{ lineHeight: '1.6', flex: 1, overflow: 'hidden' }}>
                                {msg.role === 'user' ? (
                                    <p style={{ margin: 0 }}>{msg.content}</p>
                                ) : (
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        components={{
                                            img: ({ src, alt }) => (
                                                <img
                                                    src={src}
                                                    alt={alt || ''}
                                                    loading="lazy"
                                                    style={{
                                                        maxWidth: '100%',
                                                        maxHeight: '300px',
                                                        borderRadius: '8px',
                                                        margin: '0.5rem 0',
                                                        objectFit: 'cover',
                                                        border: '1px solid rgba(255,255,255,0.1)',
                                                    }}
                                                    onError={e => { e.target.style.display = 'none' }}
                                                />
                                            ),
                                            a: ({ href, children }) => (
                                                <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)', textDecoration: 'underline' }}>
                                                    {children}
                                                </a>
                                            ),
                                        }}
                                    >
                                        {msg.content}
                                    </ReactMarkdown>
                                )}
                                {msg.role === 'agent' && msg.metrics && (
                                    <MetricsPanel metrics={msg.metrics} />
                                )}
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
