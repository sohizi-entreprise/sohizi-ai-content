import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { signIn, emailOtp } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp'

export const Route = createFileRoute('/sign-in')({
  component: SignInPage,
})

type Step = 'form' | 'verify-otp' | 'forgot-email' | 'forgot-otp' | 'forgot-new-password'

function SignInPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<Step>('form')
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error: signInError } = await signIn.email({ email, password })

    if (signInError) {
      if (signInError.code === 'EMAIL_NOT_VERIFIED') {
        await emailOtp.sendVerificationOtp({ email, type: 'email-verification' })
        setStep('verify-otp')
      } else {
        setError(signInError.message || 'Failed to sign in')
      }
      setLoading(false)
      return
    }

    navigate({ to: '/dashboard' })
  }

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) return
    setError('')
    setLoading(true)

    const { error: verifyError } = await emailOtp.verifyEmail({ email, otp })

    if (verifyError) {
      setError(verifyError.message || 'Invalid code. Please try again.')
      setLoading(false)
      return
    }

    const { error: signInError } = await signIn.email({ email, password })

    if (signInError) {
      setError(signInError.message || 'Verification succeeded but sign-in failed.')
      setLoading(false)
      return
    }

    navigate({ to: '/dashboard' })
  }

  const handleForgotSubmitEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error: sendError } = await emailOtp.sendVerificationOtp({
      email,
      type: 'forget-password',
    })

    if (sendError) {
      setError(sendError.message || 'Failed to send reset code.')
      setLoading(false)
      return
    }

    setOtp('')
    setStep('forgot-otp')
    setLoading(false)
  }

  const handleForgotVerifyOtp = async () => {
    if (otp.length !== 6) return
    setError('')
    setLoading(true)

    const { error: checkError } = await emailOtp.checkVerificationOtp({
      email,
      otp,
      type: 'forget-password',
    })

    if (checkError) {
      setError(checkError.message || 'Invalid code. Please try again.')
      setLoading(false)
      return
    }

    setStep('forgot-new-password')
    setLoading(false)
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setLoading(true)

    const { error: resetError } = await emailOtp.resetPassword({
      email,
      otp,
      password: newPassword,
    })

    if (resetError) {
      setError(resetError.message || 'Failed to reset password.')
      setLoading(false)
      return
    }

    setPassword('')
    setOtp('')
    setNewPassword('')
    setConfirmPassword('')
    setStep('form')
    setLoading(false)
  }

  const handleResend = async (type: 'email-verification' | 'forget-password') => {
    setResending(true)
    setResent(false)
    setError('')

    const { error: resendError } = await emailOtp.sendVerificationOtp({ email, type })

    if (resendError) {
      setError(resendError.message || 'Failed to resend code.')
    } else {
      setResent(true)
    }

    setResending(false)
  }

  const handleGoogleSignIn = async () => {
    await signIn.social({
      provider: 'google',
      callbackURL: window.location.origin + '/dashboard',
      errorCallbackURL: window.location.origin + '/auth-error',
    })
  }

  const goBack = () => {
    setError('')
    setResent(false)
    setOtp('')
    setNewPassword('')
    setConfirmPassword('')
    setStep('form')
  }

  const title: Record<Step, string> = {
    'form': 'Sign In',
    'verify-otp': 'Verify your email',
    'forgot-email': 'Forgot password?',
    'forgot-otp': 'Enter reset code',
    'forgot-new-password': 'Set new password',
  }

  const description: Record<Step, React.ReactNode> = {
    'form': 'Sign in to your Sohizi account',
    'verify-otp': <>We sent a 6-digit code to <span className="font-medium text-foreground">{email}</span></>,
    'forgot-email': "Enter your email and we'll send you a reset code",
    'forgot-otp': <>We sent a 6-digit code to <span className="font-medium text-foreground">{email}</span></>,
    'forgot-new-password': 'Enter your new password below',
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{title[step]}</CardTitle>
          <CardDescription>{description[step]}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">

          {step === 'form' && (
            <>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleGoogleSignIn}
              >
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Continue with Google
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">or continue with email</span>
                </div>
              </div>

              <form onSubmit={handleEmailSignIn} className="space-y-4">
                <div className="space-y-2" suppressHydrationWarning>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    data-lpignore="true"
                    data-1p-ignore
                    data-form-type="other"
                  />
                </div>
                <div className="space-y-2" suppressHydrationWarning>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline underline-offset-4"
                      onClick={() => { setError(''); setStep('forgot-email') }}
                    >
                      Forgot password?
                    </button>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    data-lpignore="true"
                    data-1p-ignore
                    data-form-type="other"
                  />
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Spinner />}
                  {loading ? 'Signing in...' : 'Sign In'}
                </Button>
              </form>
            </>
          )}

          {step === 'forgot-email' && (
            <form onSubmit={handleForgotSubmitEmail} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-email">Email</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Spinner />}
                {loading ? 'Sending...' : 'Send Reset Code'}
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  className="text-sm text-primary hover:underline underline-offset-4"
                  onClick={goBack}
                >
                  Back to sign in
                </button>
              </div>
            </form>
          )}

          {(step === 'verify-otp' || step === 'forgot-otp') && (
            <div className="space-y-6">
              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={otp}
                  onChange={setOtp}
                  onComplete={step === 'verify-otp' ? handleVerifyOtp : handleForgotVerifyOtp}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              {error && <p className="text-sm text-destructive text-center">{error}</p>}

              {resent && (
                <p className="text-sm text-muted-foreground text-center">
                  A new code has been sent to your email.
                </p>
              )}

              <Button
                className="w-full"
                onClick={step === 'verify-otp' ? handleVerifyOtp : handleForgotVerifyOtp}
                disabled={otp.length !== 6 || loading}
              >
                {loading && <Spinner />}
                {loading ? 'Verifying...' : 'Verify Code'}
              </Button>

              <div className="flex items-center justify-center gap-4">
                <Button
                  variant="link"
                  className="text-sm"
                  onClick={() => handleResend(step === 'verify-otp' ? 'email-verification' : 'forget-password')}
                  disabled={resending}
                >
                  {resending ? 'Sending...' : "Resend code"}
                </Button>
                <button
                  type="button"
                  className="text-sm text-primary hover:underline underline-offset-4"
                  onClick={goBack}
                >
                  Back to sign in
                </button>
              </div>
            </div>
          )}

          {step === 'forgot-new-password' && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Spinner />}
                {loading ? 'Resetting...' : 'Reset Password'}
              </Button>
            </form>
          )}

        </CardContent>
        <CardFooter className="justify-center">
          <p className="text-sm text-muted-foreground">
            Don't have an account?{' '}
            <Link to="/sign-up" className="text-primary underline-offset-4 hover:underline">
              Sign up
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
