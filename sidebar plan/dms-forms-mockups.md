# DMS Forms Visual Mockups

## Slide-out Panel Design

### General Layout
```
┌─────────────────────────────────────────────────────────────────┐
│ Main Content Area                                              │
│                                                               │
│   [Existing Projects/Tasks Content]                            │
│                                                               │
│                                                               │
├─────────────────────────────────────────────────────────────────┤
│                         SLIDE-OUT PANEL                        │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Header: [X] New Project / New Task                        │ │
│ ├─────────────────────────────────────────────────────────────┤ │
│ │                                                         │ │
│ │  Form Fields Area                                        │ │
│ │                                                         │ │
│ │  [Field 1]                                              │ │
│ │  [Field 2]                                              │ │
│ │  [Field 3]                                              │ │
│ │  ...                                                    │ │
│ │                                                         │ │
│ ├─────────────────────────────────────────────────────────────┤ │
│ │ Footer: [Cancel] [Save]                                  │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## New Project Form Mockup

### Form Layout
```
┌─────────────────────────────────────────────────────────────┐
│ × New Project                                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Basic Information                                           │
│ ─────────────────────────────────────────────────────────── │
│ Project Name *                                             │
│ [Enter project name........................................] │
│                                                             │
│ Project Type *                                             │
│ [Facultative ▼]                                            │
│                                                             │
│ Client Name *                                               │
│ [Enter client name..........................................] │
│                                                             │
│ Country *                                                  │
│ [🇿🇦 South Africa ▼]                                       │
│                                                             │
│ Project Details                                            │
│ ─────────────────────────────────────────────────────────── │
│ Coverage Type *                                             │
│ [Enter coverage type........................................] │
│                                                             │
│ Project Value *                                             │
│ [$ 1,000,000.00]                                           │
│                                                             │
│ Currency *                                                 │
│ [USD ▼]                                                    │
│                                                             │
│ Start Date *                                               │
│ [01/25/2025 📅]                                            │
│                                                             │
│ End Date                                                   │
│ [01/25/2026 📅]                                            │
│                                                             │
│ Status *                                                   │
│ [Draft ▼]                                                  │
│                                                             │
│ Priority *                                                 │
│ [Medium ▼]                                                 │
│                                                             │
│ Description                                                │
│ [Enter project description.................................] │
│ [........................................................] │
│ [........................................................] │
│                                                             │
│ Assigned Team                                              │
│ [Team Member 1] [Team Member 2] [+ Add]                    │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ [Cancel] [Save Project]                                     │
└─────────────────────────────────────────────────────────────┘
```

### Field Details
- **Project Name**: Text input, required, min 3 chars
- **Project Type**: Dropdown (Facultative, Treaty), required
- **Client Name**: Text input, required, min 2 chars
- **Country**: Dropdown with country flags, required
- **Coverage Type**: Text input, required, min 3 chars
- **Project Value**: Currency input with formatting, required
- **Currency**: Dropdown (USD, EUR, GBP, ZAR), required
- **Start Date**: Date picker, required
- **End Date**: Date picker, optional
- **Status**: Dropdown (Draft, Active, In Progress, Pending Approval), required
- **Priority**: Dropdown (Low, Medium, High), required
- **Description**: Textarea, optional
- **Assigned Team**: Multi-select with add/remove functionality

## New Task Form Mockup

### Form Layout
```
┌─────────────────────────────────────────────────────────────┐
│ × New Task                                                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Basic Information                                           │
│ ─────────────────────────────────────────────────────────── │
│ Task Title *                                               │
│ [Enter task title............................................] │
│                                                             │
│ Task Type *                                                │
│ [📄 Upload Document ▼]                                     │
│                                                             │
│ Assignment                                                 │
│ ─────────────────────────────────────────────────────────── │
│ Assigned To *                                              │
│ [John Doe ▼]                                               │
│                                                             │
│ Project Reference *                                         │
│ [MZ-2025-FAC-002 ▼]                                       │
│                                                             │
│ Timing                                                     │
│ ─────────────────────────────────────────────────────────── │
│ Due Date *                                                 │
│ [01/25/2025 📅]                                            │
│                                                             │
│ Priority *                                                 │
│ [Medium ▼]                                                 │
│                                                             │
│ Estimated Hours                                            │
│ [8] hours                                                  │
│                                                             │
│ Additional Details                                         │
│ ─────────────────────────────────────────────────────────── │
│ Description                                                │
│ [Enter task description......................................] │
│ [........................................................] │
│ [........................................................] │
│                                                             │
│ Tags                                                       │
│ [urgent] [client] [+ Add tag]                              │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ [Cancel] [Save Task]                                        │
└─────────────────────────────────────────────────────────────┘
```

### Field Details
- **Task Title**: Text input, required, min 3 chars
- **Task Type**: Dropdown with icons (Upload Document, Review & Approve, Follow-up Action, Financial Task, Send Communication), required
- **Assigned To**: Dropdown of team members, required
- **Project Reference**: Dropdown of existing projects, required
- **Due Date**: Date picker, required
- **Priority**: Dropdown (Low, Medium, High), required
- **Estimated Hours**: Number input, optional
- **Description**: Textarea, optional
- **Tags**: Multi-select with add/remove functionality

## Visual Design Elements

### Colors and Styling
- **Primary Color**: Secondary color from existing theme
- **Required Fields**: Red asterisk (*) indicator
- **Validation Errors**: Red text below fields
- **Buttons**: Consistent with existing button styling
- **Dropdowns**: Consistent with existing Select component

### Icons
- **Task Types**: Use existing icons from lucide-react
  - Upload Document: FileText
  - Review & Approve: CheckSquare
  - Follow-up Action: Phone
  - Financial Task: DollarSign
  - Send Communication: Mail

### Animations
- **Panel Slide**: Smooth slide-in from right (300ms)
- **Field Focus**: Subtle border color change
- **Button Hover**: Consistent with existing hover effects
- **Validation**: Shake animation for errors

### Responsive Design
- **Desktop**: Full-width slide-out panel (400px wide)
- **Tablet**: Adjusted width and spacing
- **Mobile**: Full-screen overlay with slide-up animation

## Form States

### Initial State
- All fields empty or showing default values
- Validation messages hidden
- Save button disabled until required fields filled

### Validation State
- Real-time validation as user types
- Error messages appear below invalid fields
- Save button remains disabled until all required fields valid

### Success State
- Form data submitted successfully
- Panel closes with slide-out animation
- Success toast notification appears
- New item appears in list with animation

### Error State
- Validation errors displayed
- Error toast notification for submission failures
- Form remains open for corrections

## Accessibility Features

### Keyboard Navigation
- Tab order follows logical field sequence
- Escape key closes panel
- Enter key submits form when valid
- Arrow keys navigate dropdown options

### Screen Reader Support
- Proper ARIA labels for all form elements
- Live regions for validation messages
- Announcements for form submission status

### Visual Accessibility
- High contrast text
- Focus indicators for keyboard navigation
- Clear error messaging with color and text

This mockup provides a comprehensive visual guide for implementing the slide-out forms with consistent design and user experience.