
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { EyeIcon, EyeOffIcon, ArrowLeft } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle } from 'lucide-react';

const Login: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const isMobile = useIsMobile();
  const location = useLocation();
  const successMessage = location.state?.message;
  
  const navigate = useNavigate();
  
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    // Simulate API call to Frappe ERPNext
    setTimeout(() => {
      setLoading(false);
      
      // For demo purposes, we'll just navigate if email includes '@'
      if (email.includes('@') && password.length >= 6) {
        navigate('/dashboard');
      } else {
        setError('Invalid email or password. Please try again.');
      }
    }, 1500);
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-white to-blue-50 flex flex-col justify-center py-6 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="-mx-4 sm:-mx-6 lg:-mx-8 mb-6 border-b-4 border-[#D4AF37] shadow-sm">
         <img
           src="/banner.png"
           alt="MMFS Banner"
           className="w-full object-cover max-h-[180px] sm:max-h-[220px] md:max-h-[260px]"
         />
       </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md mb-2">
        <Link
          to="/"
          className="inline-flex items-center px-3 py-2 text-sm font-medium text-[#103E7C] border border-[#103E7C] rounded hover:bg-[#103E7C] hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to MMFS Hub
        </Link>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="mt-6 sm:mt-8 sm:mx-auto sm:w-full sm:max-w-md"
      >
        <div className="bg-white py-6 sm:py-8 px-4 shadow-card sm:rounded-lg sm:px-10">
          {successMessage && (
            <Alert className="mb-4 bg-green-50 border-green-100">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <AlertDescription className="text-green-700">{successMessage}</AlertDescription>
            </Alert>
          )}
          
          <form className="space-y-5 sm:space-y-6" onSubmit={handleLogin}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
                {error}
              </div>
            )}
            
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#103E7C] focus:border-[#103E7C] text-sm"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="mt-1 relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-[#103E7C] focus:border-[#103E7C] text-sm"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-500"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className={`flex items-center ${isMobile ? 'flex-col space-y-3' : 'justify-between'}`}>
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-[#103E7C] focus:ring-[#103E7C] border-gray-300 rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">
                  Remember me
                </label>
              </div>

              <div className="text-sm">
                <a href="#" className="font-medium text-[#103E7C] hover:text-[#0a3f72]">
                  Forgot your password?
                </a>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#103E7C] hover:bg-[#0a3f72] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#D4AF37] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : null}
                Sign in
              </button>
            </div>
          </form>

          <div className="mt-5 sm:mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Or continue with</span>
              </div>
            </div>

            <div className="mt-5 sm:mt-6 grid grid-cols-2 gap-3">
              <div>
                <a
                  href="#"
                  className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                >
                  <span className="sr-only">Sign in with Google</span>
                  <svg className="w-5 h-5" aria-hidden="true" fill="currentColor" viewBox="0 0 24 24">
                    <path
                      d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"
                    />
                  </svg>
                </a>
              </div>

              <div>
                <a
                  href="#"
                  className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                >
                  <span className="sr-only">Sign in with Microsoft</span>
                  <svg className="w-5 h-5" aria-hidden="true" fill="currentColor" viewBox="0 0 24 24">
                    <path
                      d="M11.5 0v11.5H0V0h11.5zm12.5 0v11.5H12.5V0H24zM11.5 12.5V24H0V12.5h11.5zm12.5 0V24H12.5V12.5H24z"
                    />
                  </svg>
                </a>
              </div>
            </div>
          </div>
          
          {/* Sign Up Link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Don't have an account?{" "}
              <Link to="/signup" className="font-medium text-[#103E7C] hover:text-[#0a3f72]">
                Sign up now
              </Link>
            </p>
          </div>
        </div>
      </motion.div>

      {/* Demo login credentials */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="mt-4 sm:mt-6 sm:mx-auto sm:w-full sm:max-w-md"
      >
        <div className="bg-blue-50 bg-opacity-70 py-3 sm:py-4 px-4 sm:px-6 rounded-md shadow-sm border border-[#103E7C] border-opacity-20">
          <h3 className="text-center text-xs sm:text-sm font-medium text-[#0a3f72] mb-2">Demo Credentials</h3>
          <div className={`${isMobile ? 'flex flex-col space-y-2' : 'grid grid-cols-2 gap-2'} text-sm`}>
            <div className="bg-white px-3 py-2 rounded">
              <span className="block text-xs text-gray-500">Email</span>
              <span className="font-medium text-[#0a3f72] text-xs sm:text-sm">demo@contas.co.za</span>
            </div>
            <div className="bg-white px-3 py-2 rounded">
              <span className="block text-xs text-gray-500">Password</span>
              <span className="font-medium text-[#0a3f72] text-xs sm:text-sm">demo123456</span>
            </div>
          </div>
          <p className="text-xs text-center mt-2 text-gray-600">Use these credentials to explore the demo application</p>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
