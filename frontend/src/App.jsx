import { useState } from 'react'
import { LayoutDashboard, Key, Bot, MessageSquare, Radio, ChevronLeft, ChevronRight } from 'lucide-react'
import AgentsManager from './components/AgentsManager'
import ApiKeysManager from './components/ApiKeysManager'
import Chat from './components/Chat'
import ChannelsManager from './components/ChannelsManager'
import ConversationsViewer from './components/ConversationsViewer'
import './index.css'

function App() {
  const [activeTab, setActiveTab] = useState('agents')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  return (
    <div className="dashboard-layout">
      <div className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <h2>
          <LayoutDashboard size={24} />
          <span className="sidebar-label">MCP Dashboard</span>
        </h2>

        <nav className="sidebar-nav">
          <div
            className={`nav-item ${activeTab === 'api_keys' ? 'active' : ''}`}
            onClick={() => setActiveTab('api_keys')}
            title="API Keys"
          >
            <Key size={18} />
            <span className="sidebar-label">API Keys</span>
          </div>

          <div
            className={`nav-item ${activeTab === 'agents' ? 'active' : ''}`}
            onClick={() => setActiveTab('agents')}
            title="Agents"
          >
            <Bot size={18} />
            <span className="sidebar-label">Agents</span>
          </div>

          <div
            className={`nav-item ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat')}
            title="Chat"
          >
            <MessageSquare size={18} />
            <span className="sidebar-label">Chat</span>
          </div>

          <div
            className={`nav-item ${activeTab === 'channels' ? 'active' : ''}`}
            onClick={() => setActiveTab('channels')}
            title="Channels"
          >
            <Radio size={18} />
            <span className="sidebar-label">Channels</span>
          </div>

          <div
            className={`nav-item ${activeTab === 'conversations' ? 'active' : ''}`}
            onClick={() => setActiveTab('conversations')}
            title="Historial"
          >
            <MessageSquare size={18} />
            <span className="sidebar-label">Historial (Móvil)</span>
          </div>
        </nav>

        <button
          className="sidebar-toggle"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          title={sidebarCollapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
        >
          {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <div className="main-content">
        {activeTab === 'api_keys' && <ApiKeysManager />}
        {activeTab === 'agents' && <AgentsManager />}
        {activeTab === 'chat' && <Chat />}
        {activeTab === 'channels' && <ChannelsManager />}
        {activeTab === 'conversations' && <ConversationsViewer />}
      </div>
    </div>
  )
}

export default App
