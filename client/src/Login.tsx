import React, { useState } from 'react';
import './Login.css';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

interface LoginProps {
  onLoginSuccess: (user: { id: number; name: string; email: string }) => void;
  darkMode: boolean;
}

export default function Login({ onLoginSuccess, darkMode }: LoginProps) {
  const [isSignUp, setIsSignUp] = useState(false);

  // Fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Sign Up OTP step
  const [signupOtpSent, setSignupOtpSent] = useState(false);
  const [otp, setOtp] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Google Modal state
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [googleEmail, setGoogleEmail] = useState("");
  const [googleName, setGoogleName] = useState("");
  const [googleOtpSent, setGoogleOtpSent] = useState(false);
  const [googleOtp, setGoogleOtp] = useState("");

  // ==========================================
  // LOGIN: email + password only
  // ==========================================
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");
      onLoginSuccess(data.user);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to log in");
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // SIGN UP STEP 1: Send OTP to email
  // ==========================================
  const handleSignupSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match. Please try again.");
      return;
    }
    if (password.length < 6) {
      setErrorMsg("Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send OTP");
      setSignupOtpSent(true);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to send verification email");
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // SIGN UP STEP 2: Verify OTP → create account
  // ==========================================
  const handleSignupVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch(`${API_URL}/api/auth/signup-verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), otp: otp.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invalid OTP");
      onLoginSuccess(data.user);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to verify OTP");
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // GOOGLE: send OTP then verify
  // ==========================================
  const handleGoogleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    if (!googleEmail.trim()) {
      setErrorMsg("Please enter your email address");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: googleName.trim() || undefined, email: googleEmail.trim() }),
      });
      if (!res.ok) throw new Error("Failed to send OTP");
      setGoogleOtpSent(true);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch(`${API_URL}/api/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: googleEmail.trim(), otp: googleOtp.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invalid OTP");
      onLoginSuccess(data.user);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to verify OTP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={darkMode ? "app dark" : "app"}>
      <div className="login-container">
        <div className="login-box">

          {/* TITLE */}
          <h2>
            {signupOtpSent
              ? "Verify Your Email"
              : isSignUp
              ? "Create an Account"
              : "Welcome Back"}
          </h2>
          <p className="login-subtitle">
            {signupOtpSent
              ? `Enter the 6-digit code sent to ${email}`
              : isSignUp
              ? "Sign up to start chatting."
              : "Sign in with your email and password."}
          </p>

          {/* Google button — only on first screen */}
          {!signupOtpSent && (
            <>
              <button
                type="button"
                className="google-btn"
                onClick={() => {
                  setGoogleEmail(email || "");
                  setGoogleName(name || "");
                  setGoogleOtpSent(false);
                  setGoogleOtp("");
                  setShowGoogleModal(true);
                }}
              >
                <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" />
                Continue with Google
              </button>

              <div className="divider">
                <span>or with email</span>
              </div>
            </>
          )}

          {/* Error message */}
          {errorMsg && (
            <div style={{
              color: '#ef4444',
              fontSize: '13px',
              marginBottom: '16px',
              padding: '8px 12px',
              background: darkMode ? 'rgba(239, 68, 68, 0.12)' : '#fee2e2',
              borderRadius: '8px',
              border: '1px solid rgba(239, 68, 68, 0.2)'
            }}>
              {errorMsg}
            </div>
          )}

          {/* ==========================================
              LOGIN FORM — email + password only
              ========================================== */}
          {!isSignUp && (
            <form onSubmit={handleLogin} className="login-form">
              <div className="input-group">
                <label>Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="input-group">
                <label>Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? "Please wait..." : "Sign In"}
              </button>
            </form>
          )}

          {/* ==========================================
              SIGN UP STEP 1 — fill form → send OTP
              ========================================== */}
          {isSignUp && !signupOtpSent && (
            <form onSubmit={handleSignupSendOtp} className="login-form">
              <div className="input-group">
                <label>User Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ashish Sharma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="input-group">
                <label>Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="input-group">
                <label>Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <div className="input-group">
                <label>Confirm Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>

              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? "Sending verification code..." : "Create Account"}
              </button>
            </form>
          )}

          {/* ==========================================
              SIGN UP STEP 2 — enter OTP to verify
              ========================================== */}
          {isSignUp && signupOtpSent && (
            <form onSubmit={handleSignupVerifyOtp} className="login-form">
              <div className="input-group">
                <label>6-Digit Verification Code</label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  style={{ letterSpacing: '6px', textAlign: 'center', fontSize: '22px', fontWeight: 'bold' }}
                />
              </div>

              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? "Verifying..." : "Verify & Create Account"}
              </button>

              <button
                type="button"
                onClick={() => { setSignupOtpSent(false); setOtp(""); setErrorMsg(""); }}
                style={{
                  background: 'none', border: 'none', color: '#10a37f',
                  fontSize: '13px', cursor: 'pointer', marginTop: '6px', fontWeight: '500'
                }}
              >
                ← Back / Resend Code
              </button>
            </form>
          )}

          {/* Toggle Sign In / Sign Up */}
          {!signupOtpSent && (
            <p className="toggle-text">
              {isSignUp ? "Already have an account? " : "Don't have an account? "}
              <button
                className="toggle-btn"
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setErrorMsg("");
                  setPassword("");
                  setConfirmPassword("");
                  setSignupOtpSent(false);
                  setOtp("");
                }}
              >
                {isSignUp ? "Sign In" : "Sign Up"}
              </button>
            </p>
          )}

        </div>
      </div>

      {/* Google Modal */}
      {showGoogleModal && (
        <div className="google-modal-overlay" onClick={() => setShowGoogleModal(false)}>
          <div className="google-modal" onClick={(e) => e.stopPropagation()}>
            <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" style={{width: '36px', marginBottom: '10px'}} />
            <h3 style={{margin: '0 0 6px 0', fontSize: '18px'}}>Continue with Google</h3>
            <p style={{fontSize: '13px', color: '#64748b', margin: '0 0 16px 0'}}>
              {googleOtpSent ? `Enter the code sent to ${googleEmail}` : "Enter your details to receive a verification code:"}
            </p>

            {errorMsg && (
              <div style={{color:'#ef4444', fontSize:'13px', marginBottom:'12px', padding:'8px 12px', background:'rgba(239,68,68,0.1)', borderRadius:'8px'}}>
                {errorMsg}
              </div>
            )}

            {!googleOtpSent ? (
              <form onSubmit={handleGoogleSendOtp} style={{display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left'}}>
                <div className="input-group">
                  <label>User Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Ashish Sharma"
                    value={googleName}
                    onChange={(e) => setGoogleName(e.target.value)}
                  />
                </div>
                <div className="input-group">
                  <label>Email Address</label>
                  <input
                    type="email"
                    required
                    placeholder="your.google@gmail.com"
                    value={googleEmail}
                    onChange={(e) => setGoogleEmail(e.target.value)}
                  />
                </div>
                <button type="submit" className="submit-btn" style={{marginTop: '10px'}} disabled={loading}>
                  {loading ? "Sending Code..." : "Send OTP to Email"}
                </button>
                <button type="button" onClick={() => setShowGoogleModal(false)}
                  style={{background:'none', border:'none', color:'#64748b', cursor:'pointer', fontSize:'13px', marginTop:'4px'}}>
                  Cancel
                </button>
              </form>
            ) : (
              <form onSubmit={handleGoogleVerifyOtp} style={{display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left'}}>
                <div className="input-group">
                  <label>6-Digit OTP Code</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    placeholder="123456"
                    value={googleOtp}
                    onChange={(e) => setGoogleOtp(e.target.value)}
                    style={{letterSpacing:'6px', textAlign:'center', fontSize:'22px', fontWeight:'bold'}}
                  />
                </div>
                <button type="submit" className="submit-btn" style={{marginTop: '10px'}} disabled={loading}>
                  {loading ? "Verifying..." : "Verify & Sign In"}
                </button>
                <button type="button" onClick={() => { setGoogleOtpSent(false); setGoogleOtp(""); setErrorMsg(""); }}
                  style={{background:'none', border:'none', color:'#10a37f', cursor:'pointer', fontSize:'13px', marginTop:'4px', fontWeight:'500'}}>
                  ← Back / Resend
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
