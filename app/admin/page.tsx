'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getAdminEmail } from '@/lib/admin-helpers';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

type TimeRange = '7d' | '30d' | '90d';

interface AnalyticsData {
  timeRange: TimeRange;
  metrics: {
    users: {
      total: number;
      current: number;
      growth: number;
    };
    trips: {
      total: number;
      current: number;
      growth: number;
      avgPerUser: number;
      avgLocationsPerTrip: number;
      avgUpdatesPerReport: number;
    };
    quotes: {
      total: number;
      current: number;
      growth: number;
      avgPerTrip: number;
    };
    driverTokens: {
      total: number;
      used: number;
      usageRate: number;
    };
    conversionFunnel: {
      users: number;
      reports: number;
      quotes: number;
      bookings: number;
      conversionRates: {
        usersToReports: number;
        reportsToQuotes: number;
        quotesToBookings: number;
        overall: number;
      };
      dropOffs: {
        usersToReports: number;
        reportsToQuotes: number;
        quotesToBookings: number;
      };
    };
  };
  charts: {
    userTimeSeries: Array<{ date: string; count: number }>;
    tripTimeSeries: Array<{ date: string; count: number }>;
    reportsPerUserTimeSeries: Array<{ date: string; reportsPerUser: number }>;
    tripsByStatus: Array<{ status: string; count: number }>;
  };
}

// Helper component for metric cards with tooltips
function MetricCard({ 
  title, 
  tooltip, 
  value, 
  description 
}: { 
  title: string; 
  tooltip: string; 
  value: React.ReactNode; 
  description: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <CardDescription>{title}</CardDescription>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-xs">{tooltip}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <CardTitle className="text-3xl">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        {description}
      </CardContent>
    </Card>
  );
}

// Helper component for chart cards with tooltips
function ChartCard({
  title,
  description,
  tooltip,
  children
}: {
  title: string;
  description: string;
  tooltip: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>{title}</CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-xs">{tooltip}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {children}
      </CardContent>
    </Card>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const { user, session, loading: authLoading } = useAuth();
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authUsers, setAuthUsers] = useState<Array<{ email: string; created_at: string }>>([]);
  const [authUsersLoading, setAuthUsersLoading] = useState(false);
  const [authUsersError, setAuthUsersError] = useState<string | null>(null);
  
  // Cache to prevent unnecessary refreshes
  const lastFetchTimeRef = useRef<number>(0);
  const lastTimeRangeRef = useRef<TimeRange>(timeRange);
  const lastSessionTokenRef = useRef<string | undefined>(undefined);
  const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

  useEffect(() => {
    // Check if user is admin
    if (!authLoading && (!user || user.email !== getAdminEmail())) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!authLoading && user?.email === getAdminEmail() && session?.access_token) {
      const now = Date.now();
      const timeSinceLastFetch = now - lastFetchTimeRef.current;
      const timeRangeChanged = lastTimeRangeRef.current !== timeRange;
      const sessionChanged = lastSessionTokenRef.current !== session.access_token;
      const hasNoData = !data;
      
      // Only fetch if:
      // 1. Time range changed
      // 2. Session token changed (new login)
      // 3. It's been more than 5 minutes since last fetch
      // 4. We don't have data yet (initial load)
      if (timeRangeChanged || sessionChanged || timeSinceLastFetch > REFRESH_INTERVAL || hasNoData) {
        lastFetchTimeRef.current = now;
        lastTimeRangeRef.current = timeRange;
        lastSessionTokenRef.current = session.access_token;
        fetchAnalytics();
        fetchAuthUsers();
      } else {
        // If we have cached data and don't need to fetch, just set loading to false
        setLoading(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange, authLoading, user, session?.access_token]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Use session from auth context - no need to refresh token every time
      if (!session?.access_token) {
        throw new Error('No active session');
      }
      
      const response = await fetch(`/api/analytics?timeRange=${timeRange}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch analytics');
      }

      setData(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const fetchAuthUsers = async () => {
    try {
      setAuthUsersLoading(true);
      setAuthUsersError(null);
      
      if (!session?.access_token) {
        throw new Error('No active session');
      }
      
      const response = await fetch(`/api/auth-users?timeRange=${timeRange}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch auth users');
      }

      setAuthUsers(result.data.users || []);
    } catch (err) {
      setAuthUsersError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setAuthUsersLoading(false);
    }
  };

  if (authLoading || !user || user.email !== getAdminEmail()) {
    return null;
  }

  const getTimeRangeLabel = (range: TimeRange) => {
    switch (range) {
      case '7d': return 'Last 7 days';
      case '30d': return 'Last 30 days';
      case '90d': return 'Last 90 days';
      default: return 'Last 30 days';
    }
  };

  const formatGrowth = (growth: number) => {
    const sign = growth >= 0 ? '+' : '';
    return `${sign}${growth.toFixed(1)}%`;
  };

  const getStatusColor = (status: string) => {
    const statusColors: Record<string, string> = {
      'draft': 'bg-gray-500',
      'confirmed': 'bg-blue-500',
      'in-progress': 'bg-yellow-500',
      'completed': 'bg-green-500',
      'cancelled': 'bg-red-500',
    };
    return statusColors[status.toLowerCase()] || 'bg-gray-500';
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Analytics dashboard</h1>
              <p className="text-muted-foreground mt-1">
                Product metrics and insights
              </p>
            </div>
            <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
              <TabsList className="bg-muted dark:bg-input/30 dark:border dark:border-input">
                <TabsTrigger value="7d" className="dark:data-[state=active]:bg-[#323236]">Week</TabsTrigger>
                <TabsTrigger value="30d" className="dark:data-[state=active]:bg-[#323236]">Month</TabsTrigger>
                <TabsTrigger value="90d" className="dark:data-[state=active]:bg-[#323236]">Quarter</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-6">
        {error && (
          <Card className="mb-6 border-red-500">
            <CardContent className="pt-6">
              <p className="text-red-500">{error}</p>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">Loading analytics...</p>
          </div>
        ) : data ? (
          <>
            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
              {/* Total Users */}
              <MetricCard
                title="Total users"
                tooltip="Total number of registered users in the system. Counts all users who have signed up via the users table."
                value={data.metrics.users.total}
                description={
                  <p className="text-xs text-muted-foreground">
                    <span className={data.metrics.users.growth >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                      {formatGrowth(data.metrics.users.growth)}
                    </span>{' '}
                    from previous period
                  </p>
                }
              />

              {/* Total Trips */}
              <MetricCard
                title="Total reports"
                tooltip="Total number of trip reports generated. Each report represents one trip analysis created by users."
                value={data.metrics.trips.total}
                description={
                  <p className="text-xs text-muted-foreground">
                    <span className={data.metrics.trips.growth >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                      {formatGrowth(data.metrics.trips.growth)}
                    </span>{' '}
                    from previous period
                  </p>
                }
              />

              {/* Avg Trips Per User */}
              <MetricCard
                title="Avg reports per user"
                tooltip="Calculated as total reports divided by total users. Shows average engagement per user."
                value={data.metrics.trips.avgPerUser.toFixed(2)}
                description={
                  <p className="text-xs text-muted-foreground">
                    All time average
                  </p>
                }
              />

              {/* Total Quotes */}
              <MetricCard
                title="Total quotes"
                tooltip="Total number of driver quotes submitted through the system. Multiple quotes can be submitted per trip."
                value={data.metrics.quotes.total}
                description={
                  <p className="text-xs text-muted-foreground">
                    <span className={data.metrics.quotes.growth >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                      {formatGrowth(data.metrics.quotes.growth)}
                    </span>{' '}
                    from previous period
                  </p>
                }
              />

              {/* Avg Quotes Per Trip */}
              <MetricCard
                title="Avg quotes per report"
                tooltip="Average number of driver quotes received per trip report. Calculated as total quotes divided by total trips."
                value={data.metrics.quotes.avgPerTrip.toFixed(2)}
                description={
                  <p className="text-xs text-muted-foreground">
                    All time average
                  </p>
                }
              />

              {/* Trip Updates Per Report */}
              <MetricCard
                title="Avg updates per report"
                tooltip="Average number of times reports are updated after creation. Tracked via the version field. Lower is better, indicating accurate initial reports."
                value={data.metrics.trips.avgUpdatesPerReport.toFixed(2)}
                description={
                  <p className="text-xs text-muted-foreground">
                    Average version number
                  </p>
                }
              />

              {/* Avg Locations Per Trip */}
              <MetricCard
                title="Avg locations per report"
                tooltip="Average number of stops/locations per trip. Calculated from the locations array in each trip."
                value={data.metrics.trips.avgLocationsPerTrip.toFixed(1)}
                description={
                  <p className="text-xs text-muted-foreground">
                    All time average
                  </p>
                }
              />

              {/* Driver Token Usage */}
              <MetricCard
                title="Driver token usage"
                tooltip="Percentage of driver tokens that have been used. Tokens are generated when drivers are assigned to trips and marked as used when drivers confirm."
                value={`${data.metrics.driverTokens.usageRate.toFixed(1)}%`}
                description={
                  <p className="text-xs text-muted-foreground">
                    {data.metrics.driverTokens.used} of {data.metrics.driverTokens.total} used
                  </p>
                }
              />
            </div>

            {/* Conversion Funnel */}
            {data.metrics.conversionFunnel && (
              <div className="mb-6">
                <ChartCard
                  title="Conversion funnel"
                  description="Journey from reports to Drivania booking"
                  tooltip="Shows the flow through the platform: Reports → Quotes → Bookings. Conversion rates show the percentage progressing to each stage."
                >
                  <div className="space-y-4 py-4 overflow-x-auto">
                    {/* Funnel Stages */}
                    <div className="flex flex-col gap-3 min-w-0">
                      {/* Reports Stage */}
                      <div className="flex items-center gap-2 sm:gap-4">
                        <div className="w-20 sm:w-24 text-sm font-medium text-muted-foreground shrink-0">Reports</div>
                        <div className="flex-1 relative min-w-0">
                          <div 
                            className="h-10 sm:h-12 bg-purple-500 rounded-md flex items-center justify-between px-2 sm:px-4 text-white font-semibold text-sm sm:text-base"
                            style={{ width: '100%', maxWidth: '100%' }}
                          >
                            <span className="truncate">{data.metrics.conversionFunnel.reports}</span>
                            <span className="text-xs opacity-90 shrink-0 ml-2">100%</span>
                          </div>
                        </div>
                      </div>

                      {/* Arrow and Conversion Rate */}
                      <div className="flex items-center gap-2 sm:gap-4">
                        <div className="w-20 sm:w-24 shrink-0"></div>
                        <div className="flex-1 flex items-center gap-1 sm:gap-2 min-w-0">
                          <div className="flex-1 h-px bg-border"></div>
                          <div className="text-xs text-muted-foreground px-1 sm:px-2 shrink-0 whitespace-nowrap">
                            {data.metrics.conversionFunnel.conversionRates.reportsToQuotes.toFixed(1)}% convert
                          </div>
                          <div className="flex-1 h-px bg-border"></div>
                        </div>
                      </div>

                      {/* Quotes Stage */}
                      <div className="flex items-center gap-2 sm:gap-4">
                        <div className="w-20 sm:w-24 text-sm font-medium text-muted-foreground shrink-0">Quotes</div>
                        <div className="flex-1 relative min-w-0">
                          <div 
                            className="h-10 sm:h-12 bg-cyan-500 rounded-md flex items-center justify-between px-2 sm:px-4 text-white font-semibold text-sm sm:text-base"
                            style={{ 
                              width: `${Math.max(10, data.metrics.conversionFunnel.reports > 0 ? (data.metrics.conversionFunnel.quotes / data.metrics.conversionFunnel.reports) * 100 : 0)}%`,
                              maxWidth: '100%'
                            }}
                          >
                            <span className="truncate">{data.metrics.conversionFunnel.quotes}</span>
                            <span className="text-xs opacity-90 shrink-0 ml-2">
                              {data.metrics.conversionFunnel.conversionRates.reportsToQuotes.toFixed(1)}%
                            </span>
                          </div>
                          {data.metrics.conversionFunnel.dropOffs.reportsToQuotes > 0 && (
                            <div className="absolute left-0 top-full mt-1 text-xs text-muted-foreground">
                              {data.metrics.conversionFunnel.dropOffs.reportsToQuotes} dropped off
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Arrow and Conversion Rate */}
                      <div className="flex items-center gap-2 sm:gap-4">
                        <div className="w-20 sm:w-24 shrink-0"></div>
                        <div className="flex-1 flex items-center gap-1 sm:gap-2 min-w-0">
                          <div className="flex-1 h-px bg-border"></div>
                          <div className="text-xs text-muted-foreground px-1 sm:px-2 shrink-0 whitespace-nowrap">
                            {data.metrics.conversionFunnel.conversionRates.quotesToBookings.toFixed(1)}% convert
                          </div>
                          <div className="flex-1 h-px bg-border"></div>
                        </div>
                      </div>

                      {/* Bookings Stage */}
                      <div className="flex items-center gap-2 sm:gap-4">
                        <div className="w-20 sm:w-24 text-sm font-medium text-muted-foreground shrink-0">Bookings</div>
                        <div className="flex-1 relative min-w-0">
                          <div 
                            className="h-10 sm:h-12 bg-green-500 rounded-md flex items-center justify-between px-2 sm:px-4 text-white font-semibold text-sm sm:text-base"
                            style={{ 
                              width: `${Math.max(10, data.metrics.conversionFunnel.reports > 0 ? (data.metrics.conversionFunnel.bookings / data.metrics.conversionFunnel.reports) * 100 : 0)}%`,
                              maxWidth: '100%'
                            }}
                          >
                            <span className="truncate">{data.metrics.conversionFunnel.bookings}</span>
                            <span className="text-xs opacity-90 shrink-0 ml-2">
                              {data.metrics.conversionFunnel.conversionRates.overall.toFixed(1)}%
                            </span>
                          </div>
                          {data.metrics.conversionFunnel.dropOffs.quotesToBookings > 0 && (
                            <div className="absolute left-0 top-full mt-1 text-xs text-muted-foreground">
                              {data.metrics.conversionFunnel.dropOffs.quotesToBookings} dropped off
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Conversion Metrics Summary */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-4 border-t border-border">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-foreground">
                          {data.metrics.conversionFunnel.conversionRates.reportsToQuotes.toFixed(1)}%
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">Reports → Quotes</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-foreground">
                          {data.metrics.conversionFunnel.conversionRates.quotesToBookings.toFixed(1)}%
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">Quotes → Bookings</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                          {data.metrics.conversionFunnel.conversionRates.overall.toFixed(1)}%
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">Overall Conversion</div>
                      </div>
                    </div>
                  </div>
                </ChartCard>
              </div>
            )}

            {/* Charts */}
            <div className="grid gap-6 md:grid-cols-2 mb-6">
              {/* Users Over Time */}
              <ChartCard
                title="Users over time"
                description="New user signups"
                tooltip="Shows the daily count of new user registrations. Aggregated by created_at timestamp from the auth.users table (all authenticated users)."
              >
                <ChartContainer
                  config={{
                    count: {
                      label: 'Users',
                      color: 'hsl(var(--chart-1))',
                    },
                  }}
                  className="h-[300px] [&_.recharts-cartesian-axis-tick_text]:fill-foreground [&_.recharts-cartesian-axis-tick_text]:opacity-70"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.charts.userTimeSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="date" 
                        tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        tick={{ fill: 'hsl(var(--foreground))', opacity: 0.7 }}
                        stroke="hsl(var(--border))"
                      />
                      <YAxis 
                        tick={{ fill: 'hsl(var(--foreground))', opacity: 0.7 }}
                        stroke="hsl(var(--border))"
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Area 
                        type="monotone" 
                        dataKey="count" 
                        stroke="#a78bfa" 
                        strokeWidth={2.5}
                        fill="#a78bfa" 
                        fillOpacity={0.4}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </ChartCard>

              {/* Trips Over Time */}
              <ChartCard
                title="Reports over time"
                description="New reports created"
                tooltip="Shows the daily count of new trip reports generated. Aggregated by created_at timestamp from the trips table."
              >
                <ChartContainer
                  config={{
                    count: {
                      label: 'Reports',
                      color: 'hsl(var(--chart-2))',
                    },
                  }}
                  className="h-[300px] [&_.recharts-cartesian-axis-tick_text]:fill-foreground [&_.recharts-cartesian-axis-tick_text]:opacity-70"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.charts.tripTimeSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="date" 
                        tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        tick={{ fill: 'hsl(var(--foreground))', opacity: 0.7 }}
                        stroke="hsl(var(--border))"
                      />
                      <YAxis 
                        tick={{ fill: 'hsl(var(--foreground))', opacity: 0.7 }}
                        stroke="hsl(var(--border))"
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Area 
                        type="monotone" 
                        dataKey="count" 
                        stroke="#22d3ee" 
                        strokeWidth={2.5}
                        fill="#22d3ee" 
                        fillOpacity={0.4}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </ChartCard>

              {/* Reports Per User Over Time */}
              <ChartCard
                title="Reports per user over time"
                description="Cumulative reports per user"
                tooltip="Shows how many reports exist per user over time. Calculated as cumulative total reports divided by cumulative total users for each date."
              >
                <ChartContainer
                  config={{
                    reportsPerUser: {
                      label: 'Reports per user',
                      color: 'hsl(var(--chart-3))',
                    },
                  }}
                  className="h-[300px] [&_.recharts-cartesian-axis-tick_text]:fill-foreground [&_.recharts-cartesian-axis-tick_text]:opacity-70"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.charts.reportsPerUserTimeSeries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="date" 
                        tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        tick={{ fill: 'hsl(var(--foreground))', opacity: 0.7 }}
                        stroke="hsl(var(--border))"
                      />
                      <YAxis 
                        tick={{ fill: 'hsl(var(--foreground))', opacity: 0.7 }}
                        stroke="hsl(var(--border))"
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Area 
                        type="monotone" 
                        dataKey="reportsPerUser" 
                        stroke="#34d399" 
                        strokeWidth={2.5}
                        fill="#34d399" 
                        fillOpacity={0.4}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </ChartCard>

              {/* Trips By Status */}
              <ChartCard
                title="Reports by status"
                description="Status distribution"
                tooltip="Distribution of reports across different status values (draft, confirmed, in-progress, completed, cancelled). Shows current state of all reports in the system."
              >
                <ChartContainer
                  config={{
                    count: {
                      label: 'Count',
                      color: 'hsl(var(--chart-4))',
                    },
                  }}
                  className="h-[300px] [&_.recharts-cartesian-axis-tick_text]:fill-foreground [&_.recharts-cartesian-axis-tick_text]:opacity-70"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.charts.tripsByStatus}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="status" 
                        tick={{ fill: 'hsl(var(--foreground))', opacity: 0.7 }}
                        stroke="hsl(var(--border))"
                      />
                      <YAxis 
                        tick={{ fill: 'hsl(var(--foreground))', opacity: 0.7 }}
                        stroke="hsl(var(--border))"
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar 
                        dataKey="count" 
                        fill="#fbbf24" 
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </ChartCard>
            </div>

            {/* Users Created Section */}
            <div className="mb-6">
              <ChartCard
                title="Users created (in selected time period)"
                description={`All users who signed up in the ${getTimeRangeLabel(timeRange).toLowerCase()}`}
                tooltip="Shows all authenticated users who created accounts during the selected time period. Data comes from Supabase auth.users table."
              >
                {authUsersError ? (
                  <div className="py-4 text-center text-red-500">
                    <p>{authUsersError}</p>
                  </div>
                ) : authUsersLoading ? (
                  <div className="py-4 text-center text-muted-foreground">
                    <p>Loading users...</p>
                  </div>
                ) : authUsers.length === 0 ? (
                  <div className="py-4 text-center text-muted-foreground">
                    <p>No users found in the selected time period.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Email</TableHead>
                          <TableHead>Created At</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {authUsers.map((user, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{user.email}</TableCell>
                            <TableCell>
                              {new Date(user.created_at).toLocaleString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </ChartCard>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

