# DMS Forms Implementation Plan

## Overview
This document outlines the implementation plan for fixing the non-working "New Project" and "New Task" buttons in the Document Management System (DMS). The solution will use slide-out panels from the side of the screen for form creation, focusing solely on UI implementation without data persistence.

## Current State Analysis

### Issues Identified
1. **Projects.tsx (Line 88-91)**: The "New Project" button has no onClick handler
2. **Tasks.tsx (Line 159-162)**: The "New Task" button has no onClick handler
3. Both buttons are styled correctly but lack functionality

### Existing UI Components Available
- Dialog components (for reference, not using modals)
- Form components (Form, FormField, FormItem, etc.)
- Input components (Input, Select, Textarea, Calendar)
- Button components with consistent styling
- Badge, Card, and other UI elements

## Implementation Approach

### 1. Slide-out Panel Design
- Create a reusable slide-out panel component that can be triggered from any page
- Panel will slide in from the right side of the screen
- Include a header with title and close button
- Content area for form fields
- Footer with action buttons (Save, Cancel)

### 2. Form Structure Design

#### New Project Form Fields
```typescript
interface ProjectFormData {
  // Basic Information
  projectName: string;
  projectType: 'Facultative' | 'Treaty';
  clientName: string;
  country: string;
  
  // Project Details
  coverage: string;
  value: string;
  currency: string;
  
  // Dates & Status
  startDate: Date;
  endDate?: Date;
  status: 'Draft' | 'Active' | 'In Progress' | 'Pending Approval';
  
  // Additional Information
  description?: string;
  assignedTeam?: string[];
  priority: 'Low' | 'Medium' | 'High';
}
```

#### New Task Form Fields
```typescript
interface TaskFormData {
  // Basic Information
  taskTitle: string;
  taskType: 'Upload Document' | 'Review & Approve' | 'Follow-up Action' | 'Financial Task' | 'Send Communication';
  
  // Assignment
  assignedTo: string;
  projectReference: string;
  
  // Timing
  dueDate: Date;
  priority: 'Low' | 'Medium' | 'High';
  
  // Additional Details
  description?: string;
  estimatedHours?: number;
  tags?: string[];
}
```

### 3. Component Architecture

#### New Components to Create
1. **SlideOutPanel** (`src/components/ui/slide-out-panel.tsx`)
   - Reusable component for slide-out functionality
   - Handles open/close states
   - Provides consistent styling

2. **NewProjectForm** (`src/components/dms/NewProjectForm.tsx`)
   - Form component for creating new projects
   - Uses react-hook-form for form management
   - Includes validation logic

3. **NewTaskForm** (`src/components/dms/NewTaskForm.tsx`)
   - Form component for creating new tasks
   - Uses react-hook-form for form management
   - Includes validation logic

#### Modified Components
1. **Projects.tsx** - Add slide-out panel integration
2. **Tasks.tsx** - Add slide-out panel integration

### 4. User Experience Flow

#### New Project Creation Flow
1. User clicks "New Project" button
2. Slide-out panel opens from the right with form
3. User fills in required fields (marked with asterisks)
4. Real-time validation provides immediate feedback
5. User clicks "Save" to close panel and show success message
6. New project appears in the project list (mock data update)

#### New Task Creation Flow
1. User clicks "New Task" button
2. Slide-out panel opens from the right with form
3. User fills in required fields
4. Real-time validation provides immediate feedback
5. User clicks "Save" to close panel and show success message
6. New task appears in the appropriate task section (mock data update)

### 5. Form Validation Rules

#### Project Form Validation
- **Project Name**: Required, min 3 characters, max 100 characters
- **Project Type**: Required selection
- **Client Name**: Required, min 2 characters
- **Country**: Required selection
- **Coverage**: Required, min 3 characters
- **Value**: Required, positive number
- **Currency**: Required selection
- **Start Date**: Required, not in the past
- **Status**: Required selection
- **Priority**: Required selection

#### Task Form Validation
- **Task Title**: Required, min 3 characters, max 200 characters
- **Task Type**: Required selection
- **Assigned To**: Required selection
- **Project Reference**: Required selection
- **Due Date**: Required, not in the past
- **Priority**: Required selection

### 6. State Management Approach

#### Local State Management
- Use React's useState for managing slide-out panel open/close state
- Use react-hook-form for form state management
- Update mock data arrays when forms are submitted
- No external state management library needed

#### Data Flow
1. Form data captured in component state
2. Validation performed on submit
3. Mock data arrays updated with new items
4. Slide-out panel closed
5. Success notification displayed

### 7. Implementation Steps

#### Phase 1: Create Base Components
1. Create SlideOutPanel component
2. Create NewProjectForm component with basic fields
3. Create NewTaskForm component with basic fields

#### Phase 2: Form Validation
1. Add validation rules to both forms
2. Implement error handling and display
3. Add real-time validation feedback

#### Phase 3: Integration
1. Integrate slide-out panels into Projects.tsx
2. Integrate slide-out panels into Tasks.tsx
3. Connect form submission to mock data updates

#### Phase 4: Polish & Refinement
1. Add animations and transitions
2. Improve accessibility
3. Add loading states
4. Add success/error notifications

### 8. Technical Specifications

#### Dependencies Required
- react-hook-form (already available)
- @hookform/resolvers for validation
- zod for schema validation
- lucide-react for icons (already available)

#### File Structure
```
src/
├── components/
│   ├── ui/
│   │   └── slide-out-panel.tsx (NEW)
│   └── dms/
│       ├── NewProjectForm.tsx (NEW)
│       └── NewTaskForm.tsx (NEW)
└── pages/
    └── dms/
        ├── Projects.tsx (MODIFIED)
        └── Tasks.tsx (MODIFIED)
```

### 9. Success Criteria
- [ ] "New Project" button opens slide-out panel with form
- [ ] "New Task" button opens slide-out panel with form
- [ ] Forms validate input correctly
- [ ] Forms close on successful submission
- [ ] New items appear in respective lists (mock data)
- [ ] User experience is smooth and intuitive
- [ ] Forms are accessible and keyboard-navigable
- [ ] Design is consistent with existing UI

### 10. Future Enhancements
- Backend API integration for data persistence
- File upload functionality for project documents
- Advanced filtering and search capabilities
- Bulk operations for tasks and projects
- Email notifications for task assignments
- Project templates for quick creation

## Conclusion
This implementation plan provides a comprehensive approach to fixing the non-working buttons in the DMS while maintaining consistency with the existing design system. The slide-out panel approach offers a modern, intuitive user experience without disrupting the current workflow.