import React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type ProjectFormData = {
  projectName: string;
  projectType: "Facultative" | "Treaty";
  clientName: string;
  country: string;
  coverage: string;
  value: number;
  currency: "USD" | "EUR" | "GBP" | "ZAR";
  startDate: string; // ISO date string (YYYY-MM-DD)
  endDate?: string; // ISO date string (YYYY-MM-DD)
  status: "Draft" | "Active" | "In Progress" | "Pending Approval" | "Done" | "Cancelled";
  description?: string;
  assignedTeam?: string[];
  priority: "Low" | "Medium" | "High";
};

const schema = z.object({
  projectName: z.string().min(3, "Project name must be at least 3 characters").max(100),
  projectType: z.enum(["Facultative", "Treaty"], { required_error: "Select a project type" }),
  clientName: z.string().min(2, "Client name must be at least 2 characters"),
  country: z.string().min(2, "Select a country"),
  coverage: z.string().min(3, "Coverage must be at least 3 characters"),
  value: z.number({ invalid_type_error: "Enter a valid amount" }).positive("Value must be positive"),
  currency: z.enum(["USD", "EUR", "GBP", "ZAR"], { required_error: "Select a currency" }),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional(),
  status: z.enum(["Draft", "Active", "In Progress", "Pending Approval", "Done", "Cancelled"], { required_error: "Select a status" }),
  description: z.string().optional(),
  assignedTeamText: z.string().optional(),
  priority: z.enum(["Low", "Medium", "High"], { required_error: "Select priority" }),
}).refine((data) => !!data.startDate, {
  message: "Start date is required",
  path: ["startDate"],
});

type Schema = z.infer<typeof schema>;

export default function NewProjectForm({ onCreate, onCancel }: { onCreate: (data: ProjectFormData) => void; onCancel: () => void; }) {
  const form = useForm<Schema>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: {
      projectName: "",
      projectType: "Facultative" as any,
      clientName: "",
      country: "",
      coverage: "",
      value: undefined as any,
      currency: "ZAR" as any,
      startDate: new Date().toISOString().split("T")[0],
      endDate: "",
      status: "Active" as any,
      description: "",
      assignedTeamText: "",
      priority: "Medium" as any,
    },
  });

  const handleSubmit = (values: Schema) => {
    const assignedTeam = values.assignedTeamText
      ? values.assignedTeamText.split(",").map((s) => s.trim()).filter(Boolean)
      : undefined;

    const payload: ProjectFormData = {
      projectName: values.projectName,
      projectType: values.projectType,
      clientName: values.clientName,
      country: values.country,
      coverage: values.coverage,
      value: values.value,
      currency: values.currency,
      startDate: values.startDate,
      endDate: values.endDate || undefined,
      status: values.status,
      description: values.description || undefined,
      assignedTeam,
      priority: values.priority,
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
            name="projectName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Project Name *</FormLabel>
                <FormControl>
                  <Input placeholder="Enter project name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="projectType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Project Type *</FormLabel>
                <FormControl>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Facultative">Facultative</SelectItem>
                      <SelectItem value="Treaty">Treaty</SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="clientName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Client Name *</FormLabel>
                <FormControl>
                  <Input placeholder="Enter client name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="country"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Country *</FormLabel>
                <FormControl>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="🇿🇦 South Africa">🇿🇦 South Africa</SelectItem>
                      <SelectItem value="🇲🇿 Mozambique">🇲🇿 Mozambique</SelectItem>
                      <SelectItem value="🇿🇲 Zambia">🇿🇲 Zambia</SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Project Details */}
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold">Project Details</h3>
          </div>
          <FormField
            control={form.control}
            name="coverage"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Coverage *</FormLabel>
                <FormControl>
                  <Input placeholder="Enter coverage type" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="value"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project Value *</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" placeholder="1000000" {...field} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="currency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Currency *</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                        <SelectItem value="GBP">GBP</SelectItem>
                        <SelectItem value="ZAR">ZAR</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Dates & Status */}
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold">Dates & Status</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Start Date *</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="endDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>End Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status *</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Draft">Draft</SelectItem>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="In Progress">In Progress</SelectItem>
                        <SelectItem value="Pending Approval">Pending Approval</SelectItem>
                        <SelectItem value="Done">Done</SelectItem>
                        <SelectItem value="Cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
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
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Additional Information */}
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold">Additional Information</h3>
          </div>
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea placeholder="Enter project description" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="assignedTeamText"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Assigned Team (comma separated)</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. TK, JD, SM" {...field} />
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
            Save Project
          </Button>
        </div>
      </form>
    </Form>
  );
}