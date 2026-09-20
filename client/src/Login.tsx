import React, { useState } from 'react';
import './Login.css';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

interface LoginProps {
  onLoginSuccess: (user: { id: number; name: string; email: string }) => void;
  darkMode: boolean;
}

export default function Login({ onLoginSuccess, darkMode }: LoginProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [useOtpMode, setUseOtpMode] = useState(false);
  
  // Fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  // OTP flow state
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Google Modal state
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [googleEmail, setGoogleEmail] = useState("");
  const [googleName, setGoogleName] = useState("");

  // ==========================================
  // PASSWORD AUTH (SIGN UP & SIGN IN)
  // ==========================================

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    if (isSignUp && password !== confirmPassword) {
      setErrorMsg("Passwords do not match. Please try again.");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setErrorMsg("Password must be at least 6 characters long.");
      setLoading(false);
      return;
    }

    try {
      const endpoint = isSignUp 
        ? `${API_URL}/api/auth/signup` 
        : `${API_URL}/api/auth/login`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: isSignUp ? name : undefined,
          email: email.trim(),
          password: password,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Authentication failed");

      onLoginSuccess(data.user);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to authenticate");
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // OTP AUTH FLOW
  // ==========================================

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    
    try {
      const res = await fetch(`${API_URL}/api/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: isSignUp ? name : undefined, email: email.trim() })
      });
      
      if (!res.ok) throw new Error("Failed to send OTP");
      
      setOtpSent(true);
    } catch (err: any) {
      setErrorMsg(err.message || "Error sending OTP. Make sure backend is running.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch(`${API_URL}/api/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), otp: otp.trim() })
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

  const handleGoogleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    const targetEmail = googleEmail.trim();
    const targetName = googleName.trim();

    if (!targetEmail) {
      setErrorMsg("Please enter your email address");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: targetName || undefined, email: targetEmail })
      });

      if (!res.ok) throw new Error("Failed to send OTP to Google account");

      setEmail(targetEmail);
      if (targetName) setName(targetName);
      setShowGoogleModal(false);
      setUseOtpMode(true);
      setOtpSent(true);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={darkMode ? "app dark" : "app"}>
      <div className="login-container">
        <div className="login-box">
          <h2>{useOtpMode && otpSent ? "Verify Email" : isSignUp ? "Create an Account" : "Welcome Back"}</h2>
          <p className="login-subtitle">
            {useOtpMode && otpSent 
              ? `Enter the 6-digit code sent to ${email}` 
              : isSignUp ? "Sign up to start chatting." : "Sign in with your email and password."}
          </p>

          {!otpSent && (
            <>
              <button 
                type="button" 
                className="google-btn"
                onClick={() => {
                  setGoogleEmail(email || "");
                  setGoogleName(name || "");
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
              FORM 1: PASSWORD AUTH (STANDARD)
              ========================================== */}
          {!useOtpMode && (
            <form onSubmit={handlePasswordSubmit} className="login-form">
              {isSignUp && (
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
              )}

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

              {isSignUp && (
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
              )}

              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? "Please wait..." : isSignUp ? "Create Account" : "Sign In"}
              </button>

              <button 
                type="button" 
                onClick={() => { setUseOtpMode(true); setErrorMsg(""); }}
                style={{
                  background: 'none', 
                  border: 'none', 
                  color: '#10a37f', 
                  fontSize: '13px', 
                  cursor: 'pointer',
                  marginTop: '6px',
                  fontWeight: '500'
                }}
              >
                🔐 Sign in with OTP code instead
              </button>
            </form>
          )}

          {/* ==========================================
              FORM 2: OTP CODE AUTH
              ========================================== */}
          {useOtpMode && (
            <form onSubmit={otpSent ? handleVerifyOtp : handleSendOtp} className="login-form">
              {!otpSent ? (
                <>
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
                </>
              ) : (
                <div className="input-group">
                  <label>6-Digit OTP Code</label>
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
              )}

              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? "Please wait..." : otpSent ? "Verify & Log In" : "Send OTP"}
              </button>

              <button 
                type="button" 
                onClick={() => { setUseOtpMode(false); setOtpSent(false); setErrorMsg(""); }}
                style={{
                  background: 'none', 
                  border: 'none', 
                  color: '#10a37f', 
                  fontSize: '13px', 
                  cursor: 'pointer',
                  marginTop: '6px',
                  fontWeight: '500'
                }}
              >
                🔑 Use Password instead
              </button>
            </form>
          )}

          {/* Toggle between Sign In & Sign Up */}
          {!otpSent && (
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
            <p style={{fontSize: '13px', color: '#64748b', margin: '0 0 16px 0'}}>Enter your details to receive a verification code:</p>

            <form onSubmit={handleGoogleSubmit} style={{display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left'}}>
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

              <button 
                type="button" 
                onClick={() => setShowGoogleModal(false)}
                style={{
                  background: 'none', 
                  border: 'none', 
                  color: '#64748b', 
                  cursor: 'pointer',
                  fontSize: '13px',
                  marginTop: '4px'
                }}
              >
                Cancel
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
