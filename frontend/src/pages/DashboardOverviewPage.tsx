import { useEffect, useState } from 'react';
import { Calendar, Phone, TrendingUp, Clock, DollarSign, Users } from 'lucide-react';

interface Stats {
  totalCalls: number;
  answeredCalls: number;
  missedCalls: number;
  bookingsCreated: number;
  totalRevenue: number;
  avgCallDuration: string;
}

export default function DashboardOverviewPage() {
  const [stats, setStats] = useState<Stats>({
    totalCalls: 0,
    answeredCalls: 0,
    missedCalls: 0,
    bookingsCreated: 0,
    totalRevenue: 0,
    avgCallDuration: '0:00'
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // TODO: Fetch real stats from API
    const fetchStats = async () => {
      try {
        // Mock data for now
        setTimeout(() => {
          setStats({
            totalCalls: 247,
            answeredCalls: 231,
            missedCalls: 16,
            bookingsCreated: 189,
            totalRevenue: 4750,
            avgCallDuration: '2:34'
          });
          setIsLoading(false);
        }, 500);
      } catch (error) {
        console.error('Failed to fetch stats:', error);
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  const statCards = [
    {
      title: 'Total Calls',
      value: stats.totalCalls,
      icon: Phone,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      change: '+12%',
      changeType: 'increase' as const
    },
    {
      title: 'Answered',
      value: stats.answeredCalls,
      icon: Phone,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      change: '+8%',
      changeType: 'increase' as const
    },
    {
      title: 'Bookings Created',
      value: stats.bookingsCreated,
      icon: Calendar,
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20',
      change: '+15%',
      changeType: 'increase' as const
    },
    {
      title: 'Revenue Generated',
      value: `$${stats.totalRevenue.toLocaleString()}`,
      icon: DollarSign,
      color: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
      change: '+23%',
      changeType: 'increase' as const
    },
    {
      title: 'Avg Call Duration',
      value: stats.avgCallDuration,
      icon: Clock,
      color: 'text-orange-600 dark:text-orange-400',
      bgColor: 'bg-orange-50 dark:bg-orange-900/20',
      change: '-5%',
      changeType: 'decrease' as const
    },
    {
      title: 'Missed Calls',
      value: stats.missedCalls,
      icon: Phone,
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      change: '-3%',
      changeType: 'decrease' as const
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard Overview</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Welcome back! Here's what's happening with your AI receptionist.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {statCards.map(stat => (
          <div
            key={stat.title}
            className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{stat.title}</p>
                <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
                  {isLoading ? '...' : stat.value}
                </p>
                <div className="mt-2 flex items-center gap-1">
                  <TrendingUp
                    className={`w-4 h-4 ${
                      stat.changeType === 'increase' ? 'text-green-600' : 'text-red-600'
                    }`}
                  />
                  <span
                    className={`text-sm font-medium ${
                      stat.changeType === 'increase' ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {stat.change}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">vs last month</span>
                </div>
              </div>
              <div className={`p-3 rounded-full ${stat.bgColor}`}>
                <stat.icon className={`w-8 h-8 ${stat.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Calls */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Calls</h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <div
                  key={i}
                  className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-full">
                      <Phone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        +1 (555) {100 + i}00-0000
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{i * 5} minutes ago</p>
                    </div>
                  </div>
                  <span className="px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded">
                    Answered
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Bookings */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Bookings</h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <div
                  key={i}
                  className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-full">
                      <Calendar className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">Haircut - John Doe</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Today at {2 + i}:00 PM</p>
                    </div>
                  </div>
                  <span className="px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded">
                    Confirmed
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 transition-colors">
            <Calendar className="w-6 h-6 text-gray-600 dark:text-gray-400 mb-2" />
            <p className="text-sm font-medium text-gray-900 dark:text-white">View Calendar</p>
          </button>
          <button className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 transition-colors">
            <Phone className="w-6 h-6 text-gray-600 dark:text-gray-400 mb-2" />
            <p className="text-sm font-medium text-gray-900 dark:text-white">View Call Log</p>
          </button>
          <button className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 transition-colors">
            <Users className="w-6 h-6 text-gray-600 dark:text-gray-400 mb-2" />
            <p className="text-sm font-medium text-gray-900 dark:text-white">Manage Customers</p>
          </button>
          <button className="p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 transition-colors">
            <TrendingUp className="w-6 h-6 text-gray-600 dark:text-gray-400 mb-2" />
            <p className="text-sm font-medium text-gray-900 dark:text-white">View Analytics</p>
          </button>
        </div>
      </div>
    </div>
  );
}
