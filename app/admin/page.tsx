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
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
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
  };
  charts: {
    userTimeSeries: Array<{ date: string; count: number }>;
    tripTimeSeries: Array<{ date: string; count: number }>;
    reportsPerUserTimeSeries: Array<{ date: string; reportsPerUser: number }>;
    tripsByStatus: Array<{ status: string; count: number }>;
  };
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
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total users</CardDescription>
                  <CardTitle className="text-3xl">{data.metrics.users.total}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    <span className={data.metrics.users.growth >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {formatGrowth(data.metrics.users.growth)}
                    </span>{' '}
                    from previous period
                  </p>
                </CardContent>
              </Card>

              {/* Total Trips */}
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total reports</CardDescription>
                  <CardTitle className="text-3xl">{data.metrics.trips.total}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    <span className={data.metrics.trips.growth >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {formatGrowth(data.metrics.trips.growth)}
                    </span>{' '}
                    from previous period
                  </p>
                </CardContent>
              </Card>

              {/* Avg Trips Per User */}
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Avg reports per user</CardDescription>
                  <CardTitle className="text-3xl">{data.metrics.trips.avgPerUser.toFixed(2)}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    All time average
                  </p>
                </CardContent>
              </Card>

              {/* Total Quotes */}
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total quotes</CardDescription>
                  <CardTitle className="text-3xl">{data.metrics.quotes.total}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    <span className={data.metrics.quotes.growth >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {formatGrowth(data.metrics.quotes.growth)}
                    </span>{' '}
                    from previous period
                  </p>
                </CardContent>
              </Card>

              {/* Avg Quotes Per Trip */}
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Avg quotes per report</CardDescription>
                  <CardTitle className="text-3xl">{data.metrics.quotes.avgPerTrip.toFixed(2)}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    All time average
                  </p>
                </CardContent>
              </Card>

              {/* Trip Updates Per Report */}
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Avg updates per report</CardDescription>
                  <CardTitle className="text-3xl">{data.metrics.trips.avgUpdatesPerReport.toFixed(2)}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Average version number
                  </p>
                </CardContent>
              </Card>

              {/* Avg Locations Per Trip */}
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Avg locations per report</CardDescription>
                  <CardTitle className="text-3xl">{data.metrics.trips.avgLocationsPerTrip.toFixed(1)}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    All time average
                  </p>
                </CardContent>
              </Card>

              {/* Driver Token Usage */}
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Driver token usage</CardDescription>
                  <CardTitle className="text-3xl">{data.metrics.driverTokens.usageRate.toFixed(1)}%</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    {data.metrics.driverTokens.used} of {data.metrics.driverTokens.total} used
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <div className="grid gap-6 md:grid-cols-2 mb-6">
              {/* Users Over Time */}
              <Card>
                <CardHeader>
                  <CardTitle>Users over time</CardTitle>
                  <CardDescription>New user signups</CardDescription>
                </CardHeader>
                <CardContent>
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
                </CardContent>
              </Card>

              {/* Trips Over Time */}
              <Card>
                <CardHeader>
                  <CardTitle>Reports over time</CardTitle>
                  <CardDescription>New reports created</CardDescription>
                </CardHeader>
                <CardContent>
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
                </CardContent>
              </Card>

              {/* Reports Per User Over Time */}
              <Card>
                <CardHeader>
                  <CardTitle>Reports per user over time</CardTitle>
                  <CardDescription>Cumulative reports per user</CardDescription>
                </CardHeader>
                <CardContent>
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
                </CardContent>
              </Card>

              {/* Trips By Status */}
              <Card>
                <CardHeader>
                  <CardTitle>Reports by status</CardTitle>
                  <CardDescription>Status distribution</CardDescription>
                </CardHeader>
                <CardContent>
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
                </CardContent>
              </Card>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

