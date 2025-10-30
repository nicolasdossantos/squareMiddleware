import { useEffect, useState } from 'react';
import { Phone, Clock, Play, Download, Filter, Search } from 'lucide-react';

interface Call {
  id: string;
  callId: string;
  fromNumber: string;
  direction: 'inbound' | 'outbound';
  startTimestamp: string;
  endTimestamp: string;
  durationMs: number;
  transcript?: string;
  recordingUrl?: string;
  callAnalysis?: {
    call_successful?: boolean;
    booking_created?: boolean;
    user_sentiment?: string;
    language_preference?: string;
    call_summary?: string;
  };
  status: 'answered' | 'missed' | 'voicemail';
}

export default function AICallsPage() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showTranscript, setShowTranscript] = useState(false);

  useEffect(() => {
    fetchCalls();
  }, [filterStatus]);

  const fetchCalls = async () => {
    setIsLoading(true);
    try {
      // TODO: Replace with actual API call
      // const response = await fetch(`/api/calls?status=${filterStatus}`)
      // const data = await response.json()

      // Mock data
      setTimeout(() => {
        const mockCalls: Call[] = [
          {
            id: '1',
            callId: 'call_abc123',
            fromNumber: '+1 (555) 100-0001',
            direction: 'inbound',
            startTimestamp: new Date(Date.now() - 3600000).toISOString(),
            endTimestamp: new Date(Date.now() - 3500000).toISOString(),
            durationMs: 100000,
            status: 'answered',
            callAnalysis: {
              call_successful: true,
              booking_created: true,
              user_sentiment: 'positive',
              language_preference: 'en',
              call_summary: 'Customer called to book a haircut appointment for tomorrow at 2 PM'
            },
            transcript:
              "AI: Hello! This is Elite Barbershop. How can I help you today?\n\nCustomer: Hi, I'd like to book a haircut for tomorrow.\n\nAI: I'd be happy to help you with that! What time works best for you?\n\nCustomer: Around 2 PM would be great.\n\nAI: Perfect! I have availability at 2:00 PM tomorrow. Can I get your name?\n\nCustomer: It's John Smith.\n\nAI: Great, John! I've booked you for a haircut tomorrow at 2:00 PM. You'll receive a confirmation text shortly. Is there anything else I can help you with?\n\nCustomer: No, that's all. Thank you!\n\nAI: You're welcome! We look forward to seeing you tomorrow at 2 PM. Have a great day!",
            recordingUrl: '/api/calls/call_abc123/recording'
          },
          {
            id: '2',
            callId: 'call_def456',
            fromNumber: '+1 (555) 200-0002',
            direction: 'inbound',
            startTimestamp: new Date(Date.now() - 7200000).toISOString(),
            endTimestamp: new Date(Date.now() - 7100000).toISOString(),
            durationMs: 100000,
            status: 'answered',
            callAnalysis: {
              call_successful: true,
              booking_created: false,
              user_sentiment: 'neutral',
              language_preference: 'en',
              call_summary: 'Customer called to inquire about pricing and services'
            }
          },
          {
            id: '3',
            callId: 'call_ghi789',
            fromNumber: '+1 (555) 300-0003',
            direction: 'inbound',
            startTimestamp: new Date(Date.now() - 10800000).toISOString(),
            endTimestamp: new Date(Date.now() - 10800000).toISOString(),
            durationMs: 0,
            status: 'missed',
            callAnalysis: undefined
          }
        ];
        setCalls(mockCalls);
        setIsLoading(false);
      }, 500);
    } catch (error) {
      console.error('Failed to fetch calls:', error);
      setIsLoading(false);
    }
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    };
  };

  const getStatusColor = (status: Call['status']) => {
    const colors = {
      answered: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
      missed: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
      voicemail: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
    };
    return colors[status];
  };

  const getSentimentEmoji = (sentiment?: string) => {
    if (!sentiment) return '😐';
    const emojis: Record<string, string> = {
      positive: '😊',
      neutral: '😐',
      negative: '😞'
    };
    return emojis[sentiment] || '😐';
  };

  const filteredCalls = calls.filter(call => {
    const matchesSearch =
      call.fromNumber.includes(searchQuery) ||
      call.callAnalysis?.call_summary?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || call.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">AI Call History</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Review all calls handled by your AI receptionist
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search phone number or summary..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 appearance-none"
            >
              <option value="all">All Calls</option>
              <option value="answered">Answered</option>
              <option value="missed">Missed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Calls Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Calls List */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-12 text-center">
              <div className="inline-block w-8 h-8 border-4 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
              <p className="mt-4 text-gray-600 dark:text-gray-400">Loading calls...</p>
            </div>
          ) : filteredCalls.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-12 text-center">
              <Phone className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600 dark:text-gray-400">No calls found</p>
            </div>
          ) : (
            filteredCalls.map(call => {
              const { date, time } = formatDateTime(call.startTimestamp);
              const isSelected = selectedCall?.id === call.id;

              return (
                <div
                  key={call.id}
                  onClick={() => {
                    setSelectedCall(call);
                    setShowTranscript(false);
                  }}
                  className={`bg-white dark:bg-gray-800 rounded-lg shadow border cursor-pointer transition-all ${
                    isSelected
                      ? 'border-blue-500 dark:border-blue-400 ring-2 ring-blue-200 dark:ring-blue-800'
                      : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600'
                  } p-4`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-full">
                        <Phone className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{call.fromNumber}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {date} • {time}
                        </p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(call.status)}`}>
                      {call.status}
                    </span>
                  </div>

                  {call.callAnalysis && (
                    <>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 line-clamp-2">
                        {call.callAnalysis.call_summary}
                      </p>

                      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {formatDuration(call.durationMs)}
                        </div>
                        {call.callAnalysis.booking_created && (
                          <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
                            ✓ Booking
                          </span>
                        )}
                        {call.callAnalysis.user_sentiment && (
                          <span className="flex items-center gap-1">
                            {getSentimentEmoji(call.callAnalysis.user_sentiment)}
                            {call.callAnalysis.user_sentiment}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Call Details */}
        <div className="sticky top-6">
          {selectedCall ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Call Details</h2>

                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Phone Number</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {selectedCall.fromNumber}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Call ID</p>
                    <p className="text-sm font-mono text-gray-900 dark:text-white">{selectedCall.callId}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Duration</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {formatDuration(selectedCall.durationMs)}
                    </p>
                  </div>
                  {selectedCall.callAnalysis && (
                    <>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Sentiment</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {getSentimentEmoji(selectedCall.callAnalysis.user_sentiment)}{' '}
                          {selectedCall.callAnalysis.user_sentiment}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Result</p>
                        <div className="flex gap-2 mt-1">
                          {selectedCall.callAnalysis.call_successful && (
                            <span className="px-2 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
                              Successful
                            </span>
                          )}
                          {selectedCall.callAnalysis.booking_created && (
                            <span className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                              Booking Created
                            </span>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="mt-6 flex gap-3">
                  {selectedCall.transcript && (
                    <button
                      onClick={() => setShowTranscript(!showTranscript)}
                      className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors text-sm"
                    >
                      {showTranscript ? 'Hide' : 'View'} Transcript
                    </button>
                  )}
                  {selectedCall.recordingUrl && (
                    <button className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg font-medium transition-colors text-sm flex items-center justify-center gap-2">
                      <Play className="w-4 h-4" />
                      Play Recording
                    </button>
                  )}
                </div>
              </div>

              {/* Transcript */}
              {showTranscript && selectedCall.transcript && (
                <div className="p-6 bg-gray-50 dark:bg-gray-900 max-h-96 overflow-y-auto">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Transcript</h3>
                    <button className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200">
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="prose dark:prose-invert max-w-none">
                    <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-sans">
                      {selectedCall.transcript}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-12 text-center">
              <Phone className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600 dark:text-gray-400">Select a call to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
