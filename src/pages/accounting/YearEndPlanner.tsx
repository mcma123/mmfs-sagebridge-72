import React, { useEffect, useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ChevronLeft, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getPlannerStats, getYearEndChecklist, PlannerStatsDTO, YearEndTaskDTO } from '@/lib/api/accounting';
import PlannerDashboard from '@/components/accounting/PlannerDashboard';
import PlannerKanban from '@/components/accounting/PlannerKanban';
import { useToast } from '@/components/ui/use-toast';

const YearEndPlanner = () => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<PlannerStatsDTO | null>(null);
    const [tasks, setTasks] = useState<YearEndTaskDTO[]>([]);

    const loadData = async () => {
        setLoading(true);
        try {
            // Fetch stats and tasks
            // Note: In a real app, we might want to fetch these in parallel
            // For now, we'll fetch tasks and calculate stats client-side if the API isn't fully ready
            // or use the new API function if it works.

            const tasksRes = await getYearEndChecklist({ year: new Date().getFullYear() });
            const tasksData = tasksRes.items || [];
            setTasks(tasksData);

            // Calculate stats client-side for now to ensure it works even if backend logic is simple
            const calculatedStats: PlannerStatsDTO = {
                total_tasks: tasksData.length,
                completed_tasks: tasksData.filter(t => t.status === 'done' || t.completed).length,
                overdue_tasks: 0, // Mock for now
                tasks_by_status: {
                    todo: tasksData.filter(t => !t.status || t.status === 'todo').length,
                    in_progress: tasksData.filter(t => t.status === 'in_progress').length,
                    review: tasksData.filter(t => t.status === 'review').length,
                    done: tasksData.filter(t => t.status === 'done' || t.completed).length,
                },
                completion_percentage: tasksData.length > 0
                    ? (tasksData.filter(t => t.status === 'done' || t.completed).length / tasksData.length) * 100
                    : 0,
            };
            setStats(calculatedStats);

        } catch (error) {
            console.error('Failed to load planner data', error);
            toast({
                title: "Error",
                description: "Failed to load planner data",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadData();
    }, []);

    return (
        <MainLayout>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => navigate('/accounting/period-end')}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">Year-End Planner</h1>
                            <p className="text-muted-foreground">Manage your year-end closing tasks and deadlines</p>
                        </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={loadData}>
                        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>

                <Tabs defaultValue="dashboard" className="space-y-4">
                    <TabsList>
                        <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
                        <TabsTrigger value="kanban">Kanban Board</TabsTrigger>
                    </TabsList>

                    <TabsContent value="dashboard" className="space-y-4">
                        {loading ? (
                            <div className="p-8 text-center text-muted-foreground">Loading dashboard...</div>
                        ) : stats ? (
                            <PlannerDashboard stats={stats} />
                        ) : (
                            <div className="p-8 text-center text-muted-foreground">No data available</div>
                        )}
                    </TabsContent>

                    <TabsContent value="kanban" className="h-[calc(100vh-250px)]">
                        {loading ? (
                            <div className="p-8 text-center text-muted-foreground">Loading tasks...</div>
                        ) : (
                            <PlannerKanban tasks={tasks} onTaskUpdate={loadData} />
                        )}
                    </TabsContent>
                </Tabs>
            </div>
        </MainLayout>
    );
};

export default YearEndPlanner;
