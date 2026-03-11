import React, { useState, useEffect } from 'react';
import { supabase } from '@/sync/supabase';
import { ArrowLeft, Loader2, Mail, Lock, Eye, EyeOff } from 'lucide-react';

export function LoginPage() {
    const [isSignUp, setIsSignUp] = useState(false);
    const [isForgotPassword, setIsForgotPassword] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Login setup
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    
    // Reset state when switching modes
    useEffect(() => {
        setErrorMessage('');
        setSuccessMessage('');
        setEmail('');
        setPassword('');
        setConfirmPassword('');
    }, [isSignUp, isForgotPassword]);

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage('');
        setSuccessMessage('');
        setIsLoading(true);

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/update-password`,
            });
            
            if (error) {
                setErrorMessage(error.message);
            } else {
                setSuccessMessage('Check your email for the password reset link.');
            }
        } catch (err) {
            setErrorMessage('An unexpected error occurred.');
        } finally {
            setIsLoading(false);
        }
    };

    const toggleForm = () => {
        setIsSignUp(!isSignUp);
        setIsForgotPassword(false);
    }
    
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage('');
        setIsLoading(true);

        try {
            const { error } = await supabase.auth.signInWithPassword({ email, password });

            if (error) {
                setErrorMessage(error.message);
                setIsLoading(false);
                return;
            }
            // Success is handled by the global auth listener in useAuthStore/Root
        } catch (err) {
            setErrorMessage('An unexpected error occurred.');
            setIsLoading(false);
        }
    }

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage('');
        setIsLoading(true);

        if (password !== confirmPassword) {
            setErrorMessage('Passwords do not match.');
            setIsLoading(false);
            return;
        }

        try {
            const { error } = await supabase.auth.signUp({
                email,
                password,
            });

            if (error) {
                setErrorMessage(error.message);
                setIsLoading(false);
                return;
            }

            setSuccessMessage('Account created! Please check your email.');
            // We don't auto-redirect here because email confirmation might be required
            setIsLoading(false);
        } catch (err) {
            setErrorMessage('An unexpected error occurred.');
            setIsLoading(false);
        }
    }

    return (
        <div className='min-h-screen flex items-center justify-center p-4 bg-zinc-950 relative overflow-hidden'>
             {/* Background Ambience */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/20 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-600/20 rounded-full blur-[120px]" />
            </div>

            {/* Back Button - Removed since there is no landing page */}
            {/* <button
                onClick={onBack}
                className="absolute top-8 left-8 flex items-center gap-2 text-zinc-500 hover:text-zinc-200 transition-colors z-20"
            >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm font-medium">Back</span>
            </button> */}

            <div className={`relative w-full max-w-[80%] rounded-3xl shadow-2xl overflow-hidden transition-all duration-500 bg-zinc-900/40 backdrop-blur-xl h-200 min-h-200`}>
                
                {/* Rotating Border Glow (Behind content) */}
                <div className="absolute inset-0 pointer-events-none rounded-3xl overflow-hidden z-0">
                      <div className="absolute inset-[-50%] bg-[conic-gradient(from_var(--border-angle),var(--color-indigo-600)_80%,var(--color-purple-500)_86%,var(--color-indigo-300)_90%,var(--color-purple-500)_94%,var(--color-indigo-600))] animate-[spin_4s_linear_infinite]" />
                </div>
                
                {/* Mask to create border effect */}
                <div className="absolute inset-0.5 bg-zinc-950 rounded-[22px] z-0" />

                {/* Sliding Overlay */}
                <div
                    className={`hidden md:block absolute top-0 left-0 w-1/2 h-full z-20 transition-transform duration-700 ease-in-out overflow-hidden ${isSignUp ? 'translate-x-0' : 'translate-x-full'}`}
                >
                    <div 
                        className={`absolute w-[200%] h-full bg-zinc-900/50 text-white transform transition-transform duration-700 ease-in-out flex ${isSignUp ? 'translate-x-0' : '-translate-x-1/2'}`}
                    >
                        {/* Left Panel (Visible when SignUp is active -> asks to Login) */}
                        <div className='w-1/2 h-full flex flex-col items-center justify-center px-12 text-center'>
                            <h2 className='text-4xl font-bold mb-4 text-white'>Welcome Back!</h2>
                            <p className='text-center mb-8 text-indigo-100'>
                                To keep connected with us please login with your personal info
                            </p>
                            <button 
                                onClick={toggleForm}
                                className='px-10 py-3 border border-white rounded-xl font-semibold hover:bg-white hover:text-indigo-900 transition-all duration-300'
                            >
                                Sign In
                            </button>
                        </div>

                        {/* Right Panel (Visible when Login is active -> asks to SignUp) */}
                        <div className='w-1/2 h-full flex flex-col items-center justify-center px-12 text-center'>
                            <h2 className="text-4xl font-bold mb-4 text-white">New Here?</h2>
                            <p className="text-center mb-8 text-indigo-100">
                                Enter your personal details and start your journey with GirokIQ
                            </p>
                            <button
                                onClick={toggleForm}
                                className="px-10 py-3 border border-white rounded-xl font-semibold hover:bg-white hover:text-indigo-900 transition-all duration-300"
                            >
                                Sign Up
                            </button>
                        </div>
                    </div>
                </div>

                {/* Forms Layer */}
                <div className="absolute inset-0 z-10 flex">
                    
                    {/* LEFT SIDE: Login Form */}
                    <div className={`w-full md:w-1/2 h-full flex justify-center items-center transition-all duration-700 ${isSignUp ? 'opacity-0 pointer-events-none -translate-x-20' : 'opacity-100 translate-x-0'}`}>
                        <section className="text-white flex flex-col justify-center items-center w-full px-8 max-w-md">
                            {isForgotPassword ? (
                                <>
                                    <h1 className="text-3xl font-bold bg-linear-to-r from-white to-zinc-400 bg-clip-text text-transparent mb-6">Reset Password</h1>
                                    <form className="w-full flex flex-col gap-5" onSubmit={handleResetPassword}>
                                        <div className="group">
                                            <label className="block mb-1.5 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                                                Email Address
                                            </label>
                                            <div className="relative">
                                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                                                <input 
                                                    type="email"
                                                    value={email}
                                                    onChange={(e) => setEmail(e.target.value)}
                                                    required
                                                    disabled={isLoading}
                                                    className="w-full bg-white/5 rounded-xl py-3 pl-10 pr-4 border border-white/10 text-zinc-100 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all"
                                                    placeholder="you@example.com"
                                                />
                                            </div>
                                        </div>
                                    <button 
                                        type="submit" 
                                            disabled={isLoading}
                                            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
                                        >
                                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Reset Link'}
                                        </button>
                                        
                                        {errorMessage && <p className="text-red-400 text-sm text-center bg-red-500/10 p-2 rounded-lg border border-red-500/20">{errorMessage}</p>}
                                        {successMessage && <p className="text-green-400 text-sm text-center bg-green-500/10 p-2 rounded-lg border border-green-500/20">{successMessage}</p>}

                                        <button 
                                            type="button"
                                            onClick={() => setIsForgotPassword(false)}
                                            className="text-zinc-400 text-sm hover:text-white transition-colors flex items-center justify-center gap-2 mt-2"
                                        >
                                            Back to Login
                                        </button>
                                    </form>
                                </>
                            ) : (
                                <>
                                    <h1 className="text-3xl font-bold bg-linear-to-r from-white to-zinc-400 bg-clip-text text-transparent mb-2">Welcome Back</h1>
                                    <p className="text-zinc-500 mb-8 text-sm">Enter your credentials to access your workspace</p>
                                    
                                    <form className="w-full flex flex-col gap-5" onSubmit={handleLogin}>
                                        <div className="group">
                                            <label className="block mb-1.5 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                                                Email Address
                                            </label>
                                            <div className="relative">
                                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                                                <input 
                                                    type="email"
                                                    value={email}
                                                    onChange={(e) => setEmail(e.target.value)}
                                                    required
                                                    disabled={isLoading}
                                                    className="w-full bg-white/5 rounded-xl py-3 pl-10 pr-4 border border-white/10 text-zinc-100 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all"
                                                    placeholder="you@example.com"
                                                />
                                            </div>
                                        </div>

                                        <div className="group">
                                            <label className="block mb-1.5 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                                                Password
                                            </label>
                                            <div className="relative">
                                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                                                <input 
                                                    type={showPassword ? 'text' : 'password'}
                                                    value={password}
                                                    onChange={(e) => setPassword(e.target.value)}
                                                    required
                                                    disabled={isLoading}
                                                    className="w-full bg-white/5 rounded-xl py-3 pl-10 pr-12 border border-white/10 text-zinc-100 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all"
                                                    placeholder="••••••••"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                                                >
                                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="flex justify-end">
                                            <button 
                                                type="button"
                                                onClick={() => setIsForgotPassword(true)}
                                                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                                            >
                                                Forgot Password?
                                            </button>
                                        </div>

                                        <button 
                                            type="submit" 
                                            disabled={isLoading}
                                            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
                                        >
                                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign In'}
                                        </button>
                                            
                                        {errorMessage && <p className="text-red-400 text-sm text-center bg-red-500/10 p-2 rounded-lg border border-red-500/20">{errorMessage}</p>}
                                        {successMessage && <p className="text-green-400 text-sm text-center bg-green-500/10 p-2 rounded-lg border border-green-500/20">{successMessage}</p>}
                                    </form>

                                    {/* Mobile Toggle */}
                                    <div className="mt-6 text-center md:hidden">
                                        <p className="text-sm text-zinc-400">
                                            Don't have an account?{' '}
                                            <button onClick={() => setIsSignUp(true)} className="text-indigo-400 font-semibold">
                                                Sign Up
                                            </button>
                                        </p>
                                    </div>
                                </>
                            )}
                        </section>
                    </div>
                    
                    {/* RIGHT SIDE: SignUp Form */}
                    <div className={`w-full md:w-1/2 h-full flex justify-center items-center transition-all duration-700 absolute right-0 ${isSignUp ? 'opacity-100 translate-x-0' : 'opacity-0 pointer-events-none translate-x-20'}`}>
                        <section className="text-white flex flex-col justify-center items-center w-full px-8 max-w-md">
                            <h1 className="text-3xl font-bold bg-linear-to-r from-white to-zinc-400 bg-clip-text text-transparent mb-2">Create Account</h1>
                            <p className="text-zinc-500 mb-8 text-sm">Join GirokIQ to start your journey</p>

                            <form className="w-full flex flex-col gap-5" onSubmit={handleSignUp}>
                                <div className="group">
                                    <label className="block mb-1.5 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                                        Email Address
                                    </label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                                        <input 
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            required
                                            disabled={isLoading}
                                            className="w-full bg-white/5 rounded-xl py-3 pl-10 pr-4 border border-white/10 text-zinc-100 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all"
                                            placeholder="you@example.com"
                                        />
                                    </div>
                                </div>

                                <div className="group">
                                    <label className="block mb-1.5 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                                        Password
                                    </label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                                        <input 
                                            type={showPassword ? 'text' : 'password'}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            required
                                            disabled={isLoading}
                                            minLength={6}
                                            className="w-full bg-white/5 rounded-xl py-3 pl-10 pr-12 border border-white/10 text-zinc-100 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all"
                                            placeholder="••••••••"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                                        >
                                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>

                                <div className="group">
                                    <label className="block mb-1.5 text-xs font-medium text-zinc-400 uppercase tracking-wider">
                                        Confirm Password
                                    </label>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                                        <input 
                                            type={showConfirmPassword ? 'text' : 'password'}
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            required
                                            disabled={isLoading}
                                            minLength={6}
                                            className="w-full bg-white/5 rounded-xl py-3 pl-10 pr-12 border border-white/10 text-zinc-100 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all"
                                            placeholder="••••••••"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                                        >
                                            {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>
                                
                                <button 
                                    type="submit" 
                                    disabled={isLoading}
                                    className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
                                >
                                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sign Up'}
                                </button>
                                {successMessage && <p className="text-green-400 text-sm text-center bg-green-500/10 p-2 rounded-lg border border-green-500/20">{successMessage}</p>}
                                {errorMessage && <p className="text-red-400 text-sm text-center bg-red-500/10 p-2 rounded-lg border border-red-500/20">{errorMessage}</p>}
                            </form>

                            {/* Mobile Toggle */}
                            <div className="mt-6 text-center md:hidden">
                                <p className="text-sm text-zinc-400">
                                    Already have an account?{' '}
                                    <button onClick={() => setIsSignUp(false)} className="text-indigo-400 font-semibold">
                                        Sign In
                                    </button>
                                </p>
                            </div>
                        </section>        
                    </div>
                </div>
            </div>
        </div>
    )
}
