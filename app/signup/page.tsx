'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { validateBusinessEmail } from '@/lib/email-validation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function SignUpPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const { signUp, isAuthenticated } = useAuth();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, router]);

  // Validate email on blur
  const handleEmailBlur = () => {
    if (email.trim()) {
      const validation = validateBusinessEmail(email);
      if (!validation.isValid) {
        setEmailError(validation.error || 'Invalid email');
      } else {
        setEmailError('');
      }
    }
  };

  // Update email and clear error on change
  const handleEmailChange = (value: string) => {
    setEmail(value);
    if (emailError && value.trim()) {
      // Re-validate on change if there was an error
      const validation = validateBusinessEmail(value);
      if (validation.isValid) {
        setEmailError('');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    // Validation
    if (!email || !password || !confirmPassword) {
      setError('All fields are required');
      return;
    }

    // Validate business email
    const emailValidation = validateBusinessEmail(email);
    if (!emailValidation.isValid) {
      setEmailError(emailValidation.error || 'Invalid email');
      setError('Please provide a valid business email address');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const { error: signUpError } = await signUp(email, password);

      if (signUpError) {
        setError(signUpError.message);
      } else {
        setSuccess(true);
        // Redirect to home after successful signup
        setTimeout(() => {
          router.push('/');
        }, 1500);
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-start justify-center bg-background pt-12 md:pt-20 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        <img 
          src="/chauffs-logo-neutral.png" 
          alt="Driverbrief" 
          className="mx-auto h-6 w-auto mb-8"
        />
        <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">Create an Account</CardTitle>
          <CardDescription className="text-center">
            Sign up with your business email to track trips and access your history
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            {success && (
              <Alert className="bg-green-500/10 border-green-500/30">
                <AlertDescription className="text-green-500">
                  Account created successfully! Redirecting...
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Business Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => handleEmailChange(e.target.value)}
                onBlur={handleEmailBlur}
                disabled={loading}
                required
                className={emailError ? 'border-destructive focus-visible:ring-destructive' : ''}
              />
              {emailError ? (
                <p className="text-xs text-destructive font-medium">
                  {emailError}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Business email required. Personal emails (Gmail, Yahoo, etc.) are not accepted.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-[#05060A] dark:bg-[#E5E7EF] text-white dark:text-[#05060A]"
              disabled={loading || !!emailError}
            >
              {loading ? 'Creating Account...' : 'Sign Up'}
            </Button>

            <div className="text-center text-sm text-[#05060A] dark:text-[#E5E7EF]">
              Already have an account?{' '}
              <Link href="/login" className="text-[#05060A] dark:text-[#E5E7EF] hover:underline font-medium">
                Log in
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}

