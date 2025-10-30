import { useState } from 'react';
import {
  Bot,
  Power,
  Volume2,
  Clock,
  Globe,
  Phone,
  Settings,
  Activity,
  AlertCircle,
  CheckCircle,
  TrendingUp
} from 'lucide-react';

export default function AgentDashboardPage() {
  const [agentStatus, setAgentStatus] = useState<'active' | 'paused'>('active');
  const [isUpdating, setIsUpdating] = useState(false);

  // Mock agent data
  const agent = {
    displayName: 'Elite Barbershop Receptionist',
    voiceName: 'Hailey',
    voiceProvider: '11labs',
    phoneNumber: '+1 (555) 123-4567',
    language: 'English',
    timezone: 'America/New_York',
    businessHours: {
      monday: '9:00 AM - 6:00 PM',
      tuesday: '9:00 AM - 6:00 PM',
      wednesday: '9:00 AM - 6:00 PM',
      thursday: '9:00 AM - 6:00 PM',
      friday: '9:00 AM - 6:00 PM',
      saturday: '10:00 AM - 4:00 PM',
      sunday: 'Closed'
    }
  };

  const stats = {
    totalCalls: 247,
    answeredRate: 93.5,
    avgResponseTime: '1.2s',
    customerSatisfaction: 4.8,
    bookingsCreated: 189,
    conversionRate: 76.5
  };

  const toggleAgentStatus = async () => {
    setIsUpdating(true);
    try {
      // TODO: API call to toggle agent status
      // await fetch('/api/agent/status', {
      //   method: 'PUT',
      //   body: JSON.stringify({ status: agentStatus === 'active' ? 'paused' : 'active' })
      // })

      setTimeout(() => {
        setAgentStatus(agentStatus === 'active' ? 'paused' : 'active');
        setIsUpdating(false);
      }, 500);
    } catch (error) {
      console.error('Failed to toggle agent status:', error);
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Agent Dashboard</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Monitor and control your AI receptionist
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={toggleAgentStatus}
            disabled={isUpdating}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
              agentStatus === 'active'
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-green-600 hover:bg-green-700 text-white'
            } ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Power className="w-5 h-5" />
            {isUpdating ? 'Updating...' : agentStatus === 'active' ? 'Pause Agent' : 'Activate Agent'}
          </button>
        </div>
      </div>

      {/* Status Banner */}
      <div
        className={`rounded-lg p-4 border-2 ${
          agentStatus === 'active'
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
            : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
        }`}
      >
        <div className="flex items-center gap-3">
          {agentStatus === 'active' ? (
            <>
              <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
              <div>
                <p className="font-medium text-green-900 dark:text-green-100">Agent is Active</p>
                <p className="text-sm text-green-700 dark:text-green-300">
                  Your AI receptionist is currently handling calls
                </p>
              </div>
            </>
          ) : (
            <>
              <AlertCircle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
              <div>
                <p className="font-medium text-yellow-900 dark:text-yellow-100">Agent is Paused</p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  Calls will go to voicemail or your backup number
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Performance Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-full">
              <Phone className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalCalls}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">Total Calls</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-full">
              <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.answeredRate}%</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">Answer Rate</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-full">
              <Clock className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.avgResponseTime}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">Avg Response Time</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-full">
              <Bot className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
            </div>
            <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.customerSatisfaction}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">Customer Rating</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-full">
              <CheckCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.bookingsCreated}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">Bookings Created</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-full">
              <TrendingUp className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.conversionRate}%</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">Conversion Rate</p>
        </div>
      </div>

      {/* Agent Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Voice & Language Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Volume2 className="w-5 h-5" />
              Voice & Language
            </h2>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Voice</label>
              <p className="mt-1 text-sm text-gray-900 dark:text-white">
                {agent.voiceName} ({agent.voiceProvider})
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Language</label>
              <p className="mt-1 text-sm text-gray-900 dark:text-white flex items-center gap-2">
                <Globe className="w-4 h-4" />
                {agent.language}
              </p>
            </div>
            <button className="mt-4 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Update Voice Settings
            </button>
          </div>
        </div>

        {/* Phone & Availability */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Phone className="w-5 h-5" />
              Phone & Availability
            </h2>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Phone Number</label>
              <p className="mt-1 text-sm text-gray-900 dark:text-white font-mono">{agent.phoneNumber}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Timezone</label>
              <p className="mt-1 text-sm text-gray-900 dark:text-white flex items-center gap-2">
                <Clock className="w-4 h-4" />
                {agent.timezone}
              </p>
            </div>
            <button className="mt-4 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Manage Phone Number
            </button>
          </div>
        </div>
      </div>

      {/* Business Hours */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Business Hours
          </h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            These hours are synced from your Square account
          </p>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(agent.businessHours).map(([day, hours]) => (
              <div
                key={day}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">{day}</span>
                <span className="text-sm text-gray-600 dark:text-gray-400">{hours}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />
            Business hours are automatically synced from Square. Update them in your Square Dashboard.
          </p>
        </div>
      </div>

      {/* Agent Prompt */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Bot className="w-5 h-5" />
            Agent Instructions
          </h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Customize how your AI receptionist interacts with customers
          </p>
        </div>
        <div className="p-6">
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
              You are a friendly and professional receptionist for {agent.displayName}. Your main
              responsibilities are: 1. Greet customers warmly 2. Answer questions about services and pricing
              3. Schedule appointments 4. Provide business hours and location information 5. Handle
              cancellations and rescheduling Always be polite, helpful, and efficient. If you can't help with
              something, offer to take a message.
            </p>
          </div>
          <button className="mt-4 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Edit Instructions
          </button>
        </div>
      </div>
    </div>
  );
}
