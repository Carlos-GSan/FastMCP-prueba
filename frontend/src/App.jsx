import { useState } from 'react'
import { LayoutDashboard, Key, Bot, MessageSquare } from 'lucide-react'
import AgentsManager from './components/AgentsManager'
import ApiKeysManager from './components/ApiKeysManager'
import Chat from './components/Chat'
import './index.css'

function App() {
  const [activeTab, setActiveTab] = useState('agents')

  return (
    <div className="dashboard-layout">
      <div className="sidebar">
        <h2><LayoutDashboard size={24} /> MCP Dashboard</h2>

        <div
          className={`nav-item ${activeTab === 'api_keys' ? 'active' : ''}`}
          onClick={() => setActiveTab('api_keys')}
        >
          <Key size={18} /> API Keys
        </div>

        <div
          className={`nav-item ${activeTab === 'agents' ? 'active' : ''}`}
          onClick={() => setActiveTab('agents')}
        >
          <Bot size={18} /> Agents
        </div>

        <div
          className={`nav-item ${activeTab === 'chat' ? 'active' : ''}`}
          onClick={() => setActiveTab('chat')}
        >
          <MessageSquare size={18} /> Chat
        </div>
      </div>

      <div className="main-content">
        {activeTab === 'api_keys' && <ApiKeysManager />}
        {activeTab === 'agents' && <AgentsManager />}
        {activeTab === 'chat' && <Chat />}
      </div>
    </div>
  )
}

export default App
