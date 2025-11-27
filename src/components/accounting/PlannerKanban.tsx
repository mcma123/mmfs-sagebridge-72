import React, { useState } from 'react';
import { YearEndTaskDTO, YearEndTaskStatus, updateYearEndTask } from '@/lib/api/accounting';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { MoreHorizontal, Plus } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface PlannerKanbanProps {
    tasks: YearEndTaskDTO[];
    onTaskUpdate: () => void;
}

const COLUMNS: { id: YearEndTaskStatus; title: string; color: string }[] = [
    { id: 'todo', title: 'To Do', color: 'bg-gray-100' },
    { id: 'in_progress', title: 'In Progress', color: 'bg-blue-50' },
    { id: 'review', title: 'Review', color: 'bg-amber-50' },
    { id: 'done', title: 'Done', color: 'bg-green-50' },
];

const PlannerKanban: React.FC<PlannerKanbanProps> = ({ tasks, onTaskUpdate }) => {
    const { toast } = useToast();
    const [draggedTask, setDraggedTask] = useState<YearEndTaskDTO | null>(null);

    const handleStatusChange = async (taskId: number, newStatus: YearEndTaskStatus) => {
        try {
            await updateYearEndTask(taskId, { status: newStatus });
            onTaskUpdate();
            toast({
                title: "Task Updated",
                description: `Task moved to ${newStatus.replace('_', ' ')}`,
            });
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to update task status",
                variant: "destructive",
            });
        }
    };

    return (
        <div className="h-full overflow-x-auto pb-4">
            <div className="flex gap-4 min-w-[1000px] h-full">
                {COLUMNS.map(column => (
                    <div key={column.id} className={`flex-1 min-w-[250px] rounded-lg p-4 ${column.color}`}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-sm uppercase tracking-wider text-gray-700">
                                {column.title}
                            </h3>
                            <Badge variant="secondary">
                                {tasks.filter(t => (t.status || 'todo') === column.id).length}
                            </Badge>
                        </div>

                        <div className="space-y-3">
                            {tasks
                                .filter(t => (t.status || 'todo') === column.id)
                                .map(task => (
                                    <motion.div
                                        key={task.id}
                                        layoutId={String(task.id)}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="bg-white p-3 rounded shadow-sm border border-gray-200 cursor-pointer hover:shadow-md transition-shadow"
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="text-xs font-mono text-gray-500">#{task.id}</span>
                                            {task.critical && (
                                                <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4">
                                                    Critical
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="text-sm font-medium mb-2">{task.task}</p>

                                        <div className="flex justify-between items-center mt-3">
                                            <div className="flex gap-1">
                                                {/* Simple controls to move tasks if drag and drop is tricky */}
                                                {column.id !== 'todo' && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6"
                                                        onClick={() => handleStatusChange(task.id, getPrevStatus(column.id))}
                                                    >
                                                        ←
                                                    </Button>
                                                )}
                                                {column.id !== 'done' && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6"
                                                        onClick={() => handleStatusChange(task.id, getNextStatus(column.id))}
                                                    >
                                                        →
                                                    </Button>
                                                )}
                                            </div>
                                            <Button variant="ghost" size="icon" className="h-6 w-6">
                                                <MoreHorizontal className="h-4 w-4 text-gray-400" />
                                            </Button>
                                        </div>
                                    </motion.div>
                                ))}
                        </div>

                        <Button variant="ghost" className="w-full mt-4 text-gray-500 border-dashed border border-gray-300">
                            <Plus className="h-4 w-4 mr-2" />
                            Add Task
                        </Button>
                    </div>
                ))}
            </div>
        </div>
    );
};

function getNextStatus(current: YearEndTaskStatus): YearEndTaskStatus {
    const order: YearEndTaskStatus[] = ['todo', 'in_progress', 'review', 'done'];
    const idx = order.indexOf(current);
    return order[idx + 1] || current;
}

function getPrevStatus(current: YearEndTaskStatus): YearEndTaskStatus {
    const order: YearEndTaskStatus[] = ['todo', 'in_progress', 'review', 'done'];
    const idx = order.indexOf(current);
    return order[idx - 1] || current;
}

export default PlannerKanban;
