import React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type TaskFormData = {
  taskTitle: string;
  taskType: "Upload Document" | "Review & Approve" | "Follow-up Action" | "Financial Task" | "Send Communication";
  assignedTo: string;
  projectReference?: string;
  dueDate: string; // ISO date string
  priority: "Low" | "Medium" | "High" | "Urgent";
  description?: string;
  estimatedHours?: number;
  tags?: string[];
};

const schema = z.object({
  taskTitle: z.string().min(3, "Task title must be at least 3 characters").max(200),
  taskType: z.enum([
    "Upload Document",
    "Review & Approve",
    "Follow-up Action",
    "Financial Task",
    "Send Communication",
  ], { required_error: "Select a task type" }),
  assignedTo: z.string().min(1, "Select assignee"),
  // Optional link to a project
  projectReference: z.string().optional(),
  dueDate: z.string().min(1, "Due date is required"),
  priority: z.enum(["Low", "Medium", "High", "Urgent"], { required_error: "Select priority" }),
  description: z.string().optional(),
  estimatedHours: z
    .number({ invalid_type_error: "Enter a number" })
    .positive("Must be positive")
    .optional(),
  tagsText: z.string().optional(),
});

type Schema = z.infer<typeof schema>;

export default function NewTaskForm({
  onCreate,
  onCancel,
  assigneeOptions,
  projectOptions,
}: {
  onCreate: (data: TaskFormData) => void;
  onCancel: () => void;
  assigneeOptions: string[];
  projectOptions: string[];
}) {
  const form = useForm<Schema>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: {
      taskTitle: "",
      taskType: undefined as any,
      assignedTo: "",
      projectReference: "",
      dueDate: "",
      priority: undefined as any,
      description: "",
      estimatedHours: undefined,
      tagsText: "",
    },
  });

  const handleSubmit = (values: Schema) => {
    const tags = values.tagsText
      ? values.tagsText.split(",").map((s) => s.trim()).filter(Boolean)
      : undefined;
    const payload: TaskFormData = {
      taskTitle: values.taskTitle,
      taskType: values.taskType,
      assignedTo: values.assignedTo,
      projectReference: values.projectReference ? values.projectReference : undefined,
      dueDate: values.dueDate,
      priority: values.priority,
      description: values.description || undefined,
      estimatedHours: values.estimatedHours || undefined,
      tags,
    };
    onCreate(payload);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* Basic Information */}
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold">Basic Information</h3>
          </div>
          <FormField
            control={form.control}
            name="taskTitle"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Task Title *</FormLabel>
                <FormControl>
                  <Input placeholder="Enter task title" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="taskType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Task Type *</FormLabel>
                <FormControl>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Upload Document">Upload Document</SelectItem>
                      <SelectItem value="Review & Approve">Review & Approve</SelectItem>
                      <SelectItem value="Follow-up Action">Follow-up Action</SelectItem>
                      <SelectItem value="Financial Task">Financial Task</SelectItem>
                      <SelectItem value="Send Communication">Send Communication</SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Assignment */}
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold">Assignment</h3>
          </div>
          <FormField
            control={form.control}
            name="assignedTo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Assigned To *</FormLabel>
                <FormControl>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select assignee" />
                    </SelectTrigger>
                    <SelectContent>
                      {assigneeOptions.map((opt) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="projectReference"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Project Reference *</FormLabel>
                <FormControl>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select project" />
                    </SelectTrigger>
                    <SelectContent>
                      {projectOptions.map((opt) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Timing */}
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold">Timing</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="dueDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Due Date *</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Priority *</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Low">Low</SelectItem>
                        <SelectItem value="Medium">Medium</SelectItem>
                        <SelectItem value="High">High</SelectItem>
                        <SelectItem value="Urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Additional Details */}
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold">Additional Details</h3>
          </div>
          <FormField
            control={form.control}
            name="estimatedHours"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Estimated Hours</FormLabel>
                <FormControl>
                  <Input type="number" step="0.5" placeholder="e.g. 8" {...field} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea placeholder="Enter task description" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="tagsText"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tags (comma separated)</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. urgent, client" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={!form.formState.isValid}>
            Save Task
          </Button>
        </div>
      </form>
    </Form>
  );
}