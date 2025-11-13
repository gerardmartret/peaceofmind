'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { getAdminEmail } from '@/lib/admin-helpers';
import { supabase } from '@/lib/supabase';
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
    quality: {
      totalEvaluated: number;
      avgScore: number;
      breakdown: {
        critical_identification: number;
        exceptional_circumstances: number;
        actionability: number;
        communication_clarity: number;
      } | null;
      evaluationRate: number;
    };
  };
  charts: {
    userTimeSeries: Array<{ date: string; count: number }>;
    tripTimeSeries: Array<{ date: string; count: number }>;
    reportsPerUserTimeSeries: Array<{ date: string; reportsPerUser: number }>;
    qualityTimeSeries: Array<{ date: string; avgScore: number; count: number }>;
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
  const { user, loading: authLoading } = useAuth();
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if user is admin
    if (!authLoading && (!user || user.email !== getAdminEmail())) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!authLoading && user?.email === getAdminEmail()) {
      fetchAnalytics();
    }
  }, [timeRange, authLoading, user]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get the session token from Supabase
      const { data: { session } } = await supabase.auth.getSession();
      
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
              <TabsList>
                <TabsTrigger value="7d">Week</TabsTrigger>
                <TabsTrigger value="30d">Month</TabsTrigger>
                <TabsTrigger value="90d">Quarter</TabsTrigger>
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
                    <span className={data.metrics.users.growth >= 0 ? 'text-green-600' : 'text-red-600'}>
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
                    <span className={data.metrics.trips.growth >= 0 ? 'text-green-600' : 'text-red-600'}>
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
                    <span className={data.metrics.quotes.growth >= 0 ? 'text-green-600' : 'text-red-600'}>
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

              {/* Report Quality Score */}
              <MetricCard
                title="Report quality score"
                tooltip="AI-evaluated quality score (0-100). An AI judge reviews each report against 4 criteria: critical identification, exceptional circumstances, actionability, and communication clarity."
                value={`${data.metrics.quality.avgScore.toFixed(1)}/100`}
                description={
                  <p className="text-xs text-muted-foreground">
                    Based on {data.metrics.quality.totalEvaluated} evaluated reports
                  </p>
                }
              />

              {/* Quality Evaluation Rate */}
              <MetricCard
                title="Evaluation coverage"
                tooltip="Percentage of reports that have been evaluated for quality. New reports are evaluated asynchronously in the background."
                value={`${data.metrics.quality.evaluationRate.toFixed(1)}%`}
                description={
                  <p className="text-xs text-muted-foreground">
                    {data.metrics.quality.totalEvaluated} of {data.metrics.trips.total} reports
                  </p>
                }
              />
            </div>

            {/* Quality Breakdown - if available */}
            {data.metrics.quality.breakdown && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-4">Quality dimensions</h3>
                <div className="grid gap-4 md:grid-cols-4">
                  <MetricCard
                    title="Critical identification"
                    tooltip="Evaluates if AI identifies what's most important for the specific trip: critical time constraints, purpose-specific needs, and route complexity."
                    value={`${data.metrics.quality.breakdown.critical_identification.toFixed(1)}/25`}
                    description={
                      <p className="text-xs text-muted-foreground">
                        Identifying important factors
                      </p>
                    }
                  />
                  
                  <MetricCard
                    title="Exceptional circumstances"
                    tooltip="Evaluates if AI catches unusual or exceptional factors: potential issues, risks, opportunities, and demonstrates context awareness."
                    value={`${data.metrics.quality.breakdown.exceptional_circumstances.toFixed(1)}/25`}
                    description={
                      <p className="text-xs text-muted-foreground">
                        Catching unusual factors
                      </p>
                    }
                  />
                  
                  <MetricCard
                    title="Actionability"
                    tooltip="Evaluates if recommendations are clear and practical: driver can understand what to do, timing/routing is clear, and contingency plans are provided."
                    value={`${data.metrics.quality.breakdown.actionability.toFixed(1)}/25`}
                    description={
                      <p className="text-xs text-muted-foreground">
                        Clear, practical guidance
                      </p>
                    }
                  />
                  
                  <MetricCard
                    title="Communication clarity"
                    tooltip="Evaluates report structure and presentation: information is easy to find, language is clear and professional, and detail level is appropriate."
                    value={`${data.metrics.quality.breakdown.communication_clarity.toFixed(1)}/25`}
                    description={
                      <p className="text-xs text-muted-foreground">
                        Structure and readability
                      </p>
                    }
                  />
                </div>
              </div>
            )}

            {/* Charts */}
            <div className="grid gap-6 md:grid-cols-2 mb-6">
              {/* Users Over Time */}
              <ChartCard
                title="Users over time"
                description="New user signups"
                tooltip="Shows the daily count of new user registrations. Aggregated by created_at timestamp from the users table."
              >
                <ChartContainer
                  config={{
                    count: {
                      label: 'Users',
                      color: 'hsl(var(--chart-1))',
                    },
                  }}
                  className="h-[300px]"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.charts.userTimeSeries}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="date" 
                        tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Area 
                        type="monotone" 
                        dataKey="count" 
                        stroke="hsl(var(--chart-1))" 
                        fill="hsl(var(--chart-1))" 
                        fillOpacity={0.2}
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
                  className="h-[300px]"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.charts.tripTimeSeries}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="date" 
                        tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Area 
                        type="monotone" 
                        dataKey="count" 
                        stroke="hsl(var(--chart-2))" 
                        fill="hsl(var(--chart-2))" 
                        fillOpacity={0.2}
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
                  className="h-[300px]"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.charts.reportsPerUserTimeSeries}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="date" 
                        tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Area 
                        type="monotone" 
                        dataKey="reportsPerUser" 
                        stroke="hsl(var(--chart-3))" 
                        fill="hsl(var(--chart-3))" 
                        fillOpacity={0.2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </ChartCard>

              {/* Quality Score Over Time */}
              {data.charts.qualityTimeSeries.length > 0 && (
                <ChartCard
                  title="Quality score over time"
                  description="AI report quality trend"
                  tooltip="Daily average of AI-evaluated quality scores. Each report is evaluated on 4 criteria (25 pts each): critical identification, exceptional circumstances, actionability, and communication clarity."
                >
                  <ChartContainer
                    config={{
                      avgScore: {
                        label: 'Quality score',
                        color: 'hsl(var(--chart-5))',
                      },
                    }}
                    className="h-[300px]"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={data.charts.qualityTimeSeries}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="date" 
                          tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        />
                        <YAxis domain={[0, 100]} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Area 
                          type="monotone" 
                          dataKey="avgScore" 
                          stroke="hsl(var(--chart-5))" 
                          fill="hsl(var(--chart-5))" 
                          fillOpacity={0.2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </ChartCard>
              )}

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
                  className="h-[300px]"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.charts.tripsByStatus}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="status" />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar 
                        dataKey="count" 
                        fill="hsl(var(--chart-4))" 
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </ChartCard>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

