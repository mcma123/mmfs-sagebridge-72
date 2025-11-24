
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { EyeIcon, EyeOffIcon, CheckCircle, AlertCircle } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

const industries = [
  "Agriculture",
  "Banking & Finance",
  "Construction",
  "Education",
  "Energy & Utilities",
  "Entertainment",
  "Food & Beverage",
  "Healthcare",
  "Information Technology",
  "Insurance",
  "Legal",
  "Manufacturing",
  "Media & Communication",
  "Non-profit",
  "Real Estate",
  "Retail",
  "Transportation & Logistics",
  "Travel & Hospitality",
  "Other"
];

const organizationSizes = [
  { label: "1-10 employees", value: "1-10" },
  { label: "11-50 employees", value: "11-50" },
  { label: "51-200 employees", value: "51-200" },
  { label: "201-500 employees", value: "201-500" },
  { label: "500+ employees", value: "500+" }
];

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character");

const userSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  password: passwordSchema,
  confirmPassword: z.string(),
  phone: z.string().optional(),
  jobTitle: z.string().min(2, "Job title must be at least 2 characters"),
});

const organizationSchema = z.object({
  name: z.string().min(2, "Organization name must be at least 2 characters"),
  size: z.string().min(1, "Please select organization size"),
  industry: z.string().min(1, "Please select industry"),
  website: z.string().url("Please enter a valid URL").or(z.string().length(0)).optional(),
  address: z.string().optional(),
  description: z.string().max(500, "Description must be less than 500 characters").optional(),
});

const signupSchema = z
  .object({
    ...userSchema.shape,
    ...organizationSchema.shape,
  })
  .refine(data => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type SignupFormValues = z.infer<typeof signupSchema>;

const Signup: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<'user' | 'organization'>('user');
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
      phone: '',
      jobTitle: '',
      name: '',
      size: '',
      industry: '',
      website: '',
      address: '',
      description: '',
    },
  });

  const handleNextStep = async () => {
    const userFields = ['firstName', 'lastName', 'email', 'password', 'confirmPassword', 'jobTitle'];
    const result = await form.trigger(userFields as any);
    
    if (result) {
      setCurrentStep('organization');
    }
  };

  const handlePreviousStep = () => {
    setCurrentStep('user');
  };

  const onSubmit = async (data: SignupFormValues) => {
    setLoading(true);
    
    try {
      // Simulate API call
      console.log('Signup Data:', data);
      
      // Wait for 1.5 seconds to simulate server response
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Navigate to login page after successful signup
      navigate('/login', { 
        state: { 
          message: 'Account created successfully! Please login with your credentials.' 
        } 
      });
    } catch (error) {
      console.error('Signup error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPasswordStrength = (password: string): { strength: number; label: string; color: string } => {
    if (!password) return { strength: 0, label: 'No password', color: 'bg-gray-200' };
    
    let strength = 0;
    if (password.length >= 8) strength += 1;
    if (/[A-Z]/.test(password)) strength += 1;
    if (/[a-z]/.test(password)) strength += 1;
    if (/[0-9]/.test(password)) strength += 1;
    if (/[^A-Za-z0-9]/.test(password)) strength += 1;
    
    const strengthMap = {
      0: { label: 'Very Weak', color: 'bg-red-500' },
      1: { label: 'Weak', color: 'bg-red-400' },
      2: { label: 'Fair', color: 'bg-yellow-400' },
      3: { label: 'Good', color: 'bg-yellow-300' },
      4: { label: 'Strong', color: 'bg-green-400' },
      5: { label: 'Very Strong', color: 'bg-green-500' },
    };
    
    return { 
      strength, 
      label: strengthMap[strength as keyof typeof strengthMap].label, 
      color: strengthMap[strength as keyof typeof strengthMap].color 
    };
  };

  const watchPassword = form.watch('password');
  const passwordStrength = getPasswordStrength(watchPassword);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-6 sm:py-12 px-4 sm:px-6 lg:px-8 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="sm:mx-auto sm:w-full sm:max-w-md"
      >
        <div className="flex justify-center">
          <div className="w-12 h-12 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-xl">C</span>
          </div>
        </div>
        <h2 className="mt-6 text-center text-2xl sm:text-3xl font-extrabold text-gray-900">Create your account</h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Join Contas and manage your organization's finances
        </p>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="mt-6 sm:mt-8 sm:mx-auto sm:w-full sm:max-w-2xl"
      >
        <div className="bg-white py-6 sm:py-8 px-4 sm:px-10 shadow-card sm:rounded-lg">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {currentStep === 'user' ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Your information</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name</FormLabel>
                          <FormControl>
                            <Input placeholder="John" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Doe" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem className="mb-4">
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="john@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem className="mb-4">
                        <FormLabel>Password</FormLabel>
                        <div className="relative">
                          <FormControl>
                            <Input 
                              type={showPassword ? "text" : "password"} 
                              placeholder="••••••••••••" 
                              {...field} 
                            />
                          </FormControl>
                          <button
                            type="button"
                            className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-700"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
                          </button>
                        </div>
                        <div className="mt-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-gray-500">Password Strength:</span>
                            <span className="text-xs font-medium">{passwordStrength.label}</span>
                          </div>
                          <div className="w-full h-1.5 bg-gray-200 rounded-full">
                            <div 
                              className={`h-1.5 rounded-full ${passwordStrength.color}`}
                              style={{ width: `${(passwordStrength.strength / 5) * 100}%` }}
                            ></div>
                          </div>
                          <ul className="mt-2 space-y-1">
                            <li className="flex items-center text-xs text-gray-600">
                              {/^.{8,}$/.test(watchPassword) ? 
                                <CheckCircle size={12} className="mr-1 text-green-500" /> :
                                <AlertCircle size={12} className="mr-1 text-gray-400" />
                              }
                              At least 8 characters
                            </li>
                            <li className="flex items-center text-xs text-gray-600">
                              {/[A-Z]/.test(watchPassword) ? 
                                <CheckCircle size={12} className="mr-1 text-green-500" /> :
                                <AlertCircle size={12} className="mr-1 text-gray-400" />
                              }
                              Uppercase letter
                            </li>
                            <li className="flex items-center text-xs text-gray-600">
                              {/[a-z]/.test(watchPassword) ? 
                                <CheckCircle size={12} className="mr-1 text-green-500" /> :
                                <AlertCircle size={12} className="mr-1 text-gray-400" />
                              }
                              Lowercase letter
                            </li>
                            <li className="flex items-center text-xs text-gray-600">
                              {/[0-9]/.test(watchPassword) ? 
                                <CheckCircle size={12} className="mr-1 text-green-500" /> :
                                <AlertCircle size={12} className="mr-1 text-gray-400" />
                              }
                              Number
                            </li>
                            <li className="flex items-center text-xs text-gray-600">
                              {/[^A-Za-z0-9]/.test(watchPassword) ? 
                                <CheckCircle size={12} className="mr-1 text-green-500" /> :
                                <AlertCircle size={12} className="mr-1 text-gray-400" />
                              }
                              Special character
                            </li>
                          </ul>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem className="mb-4">
                        <FormLabel>Confirm Password</FormLabel>
                        <div className="relative">
                          <FormControl>
                            <Input 
                              type={showConfirmPassword ? "text" : "password"} 
                              placeholder="••••••••••••" 
                              {...field} 
                            />
                          </FormControl>
                          <button
                            type="button"
                            className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-700"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          >
                            {showConfirmPassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
                          </button>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone Number (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="+1 (555) 123-4567" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="jobTitle"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Job Title</FormLabel>
                          <FormControl>
                            <Input placeholder="Finance Manager" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="flex justify-end">
                    <Button type="button" onClick={handleNextStep}>
                      Next: Organization Details
                    </Button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Organization information</h3>
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem className="mb-4">
                        <FormLabel>Organization Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Acme Inc." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <FormField
                      control={form.control}
                      name="size"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Organization Size</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select organization size" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {organizationSizes.map((size) => (
                                <SelectItem key={size.value} value={size.value}>
                                  {size.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="industry"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Industry</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select industry" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {industries.map((industry) => (
                                <SelectItem key={industry} value={industry}>
                                  {industry}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="website"
                    render={({ field }) => (
                      <FormItem className="mb-4">
                        <FormLabel>Website URL (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="https://www.example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem className="mb-4">
                        <FormLabel>Business Address (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="123 Business St, City, Country" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem className="mb-4">
                        <FormLabel>Organization Description (Optional)</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Brief description of your organization..." 
                            className="resize-none"
                            {...field}
                          />
                        </FormControl>
                        <p className="text-xs text-gray-500 mt-1">
                          {field.value?.length || 0}/500 characters
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="flex justify-between">
                    <Button type="button" variant="outline" onClick={handlePreviousStep}>
                      Back to User Details
                    </Button>
                    <Button type="submit" disabled={loading}>
                      {loading ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Creating Account...
                        </>
                      ) : (
                        "Create Account"
                      )}
                    </Button>
                  </div>
                </motion.div>
              )}
            </form>
          </Form>
          
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Already have an account?</span>
              </div>
            </div>
            
            <div className="mt-6">
              <Link to="/login" className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                Sign in to your account
              </Link>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Signup;
