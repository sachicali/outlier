// Load test environment
require('dotenv').config({ path: '.env.test' });

/**
 * API endpoint testing examples
 * This demonstrates how to use the email verification endpoints
 */

const testEndpoints = {
  baseUrl: 'http://localhost:5000/api',
  
  // Example request bodies for testing
  examples: {
    register: {
      email: 'test@example.com',
      username: 'testuser',
      password: 'TestPassword123!',
      confirmPassword: 'TestPassword123!'
    },
    
    login: {
      identifier: 'test@example.com',
      password: 'TestPassword123!'
    },
    
    verifyEmail: {
      token: 'your-verification-token-here'
    },
    
    resendVerification: {
      email: 'test@example.com'
    },
    
    requestPasswordReset: {
      email: 'test@example.com'
    },
    
    resetPassword: {
      token: 'your-reset-token-here',
      newPassword: 'NewPassword123!',
      confirmNewPassword: 'NewPassword123!'
    }
  },

  // API endpoints documentation
  endpoints: [
    {
      method: 'POST',
      path: '/auth/register',
      description: 'Register a new user and send verification email',
      body: 'examples.register',
      response: {
        message: 'User registered successfully',
        user: '{ id, email, username, role, isEmailVerified: false, ... }',
        accessToken: 'jwt-token',
        emailVerification: {
          required: true,
          message: 'Please check your email and click the verification link'
        }
      }
    },
    
    {
      method: 'POST',
      path: '/auth/login',
      description: 'Login user (works with unverified email but shows warning)',
      body: 'examples.login',
      response: {
        message: 'Login successful',
        user: '{ id, email, username, role, isEmailVerified, ... }',
        accessToken: 'jwt-token',
        emailVerification: '{ required: true/false, message: "..." } // if unverified'
      }
    },
    
    {
      method: 'POST',
      path: '/auth/verify-email',
      description: 'Verify email address with token from email',
      body: 'examples.verifyEmail',
      response: {
        message: 'Email verified successfully',
        user: '{ id, email, username, isEmailVerified: true, emailVerifiedAt, ... }'
      }
    },
    
    {
      method: 'POST',
      path: '/auth/resend-verification',
      description: 'Resend verification email',
      body: 'examples.resendVerification',
      response: {
        message: 'Verification email sent successfully',
        email: 'test@example.com'
      }
    },
    
    {
      method: 'POST',
      path: '/auth/request-password-reset',
      description: 'Request password reset email',
      body: 'examples.requestPasswordReset',
      response: {
        message: 'If an account with this email exists, a password reset link has been sent',
        email: 'test@example.com'
      }
    },
    
    {
      method: 'POST',
      path: '/auth/reset-password',
      description: 'Reset password with token from email',
      body: 'examples.resetPassword',
      response: {
        message: 'Password reset successfully',
        user: '{ id, email, username, ... }'
      }
    },
    
    {
      method: 'GET',
      path: '/auth/email-verification-status',
      description: 'Get current user email verification status',
      headers: { Authorization: 'Bearer jwt-token' },
      response: {
        isEmailVerified: true,
        emailVerifiedAt: '2025-08-02T...',
        email: 'test@example.com',
        requiresVerification: false
      }
    },
    
    {
      method: 'GET',
      path: '/auth/status',
      description: 'Get authentication status (optional auth)',
      headers: { Authorization: 'Bearer jwt-token (optional)' },
      response: {
        authenticated: true,
        user: '{ id, email, username, isEmailVerified, ... }',
        authMethod: 'jwt'
      }
    },
    
    {
      method: 'GET',
      path: '/health/email',
      description: 'Check email service health (admin only)',
      headers: { Authorization: 'Bearer admin-jwt-token' },
      response: {
        service: 'email',
        status: 'healthy/unhealthy',
        details: {
          configured: true,
          connected: true,
          smtpHost: 'smtp.gmail.com',
          verificationTokens: '{ total, active, used, expired }'
        }
      }
    }
  ],

  // cURL examples will be generated in the documentation function

  // Frontend integration examples
  frontendExamples: {
    javascript: `
// Register user
const response = await fetch('/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    username: 'username',
    password: 'Password123!',
    confirmPassword: 'Password123!'
  })
});

const data = await response.json();
if (data.emailVerification?.required) {
  // Show message to check email
  alert(data.emailVerification.message);
}

// Verify email (from URL parameter)
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('token');
if (token) {
  const verifyResponse = await fetch('/api/auth/verify-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token })
  });
  
  if (verifyResponse.ok) {
    alert('Email verified successfully!');
  }
}`,

    react: `
// Email verification component
function EmailVerification() {
  const [isVerified, setIsVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    checkEmailVerificationStatus();
  }, []);
  
  const checkEmailVerificationStatus = async () => {
    try {
      const response = await fetch('/api/auth/email-verification-status', {
        headers: { 'Authorization': \`Bearer \${localStorage.getItem('token')}\` }
      });
      
      const data = await response.json();
      setIsVerified(data.isEmailVerified);
    } catch (error) {
      console.error('Failed to check verification status:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const resendVerification = async () => {
    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email })
      });
      
      if (response.ok) {
        alert('Verification email sent!');
      }
    } catch (error) {
      console.error('Failed to resend verification:', error);
    }
  };
  
  if (loading) return <div>Loading...</div>;
  
  return (
    <div>
      {!isVerified && (
        <div className="alert alert-warning">
          <p>Please verify your email address for full access to features.</p>
          <button onClick={resendVerification}>Resend Verification Email</button>
        </div>
      )}
    </div>
  );
}`
  }
};

// Display the API documentation
function displayApiDocumentation() {
  console.log('🔐 EMAIL VERIFICATION API DOCUMENTATION\n');
  console.log('========================================\n');
  
  console.log('📝 AVAILABLE ENDPOINTS:\n');
  testEndpoints.endpoints.forEach((endpoint, index) => {
    console.log(`${index + 1}. ${endpoint.method} ${testEndpoints.baseUrl}${endpoint.path}`);
    console.log(`   Description: ${endpoint.description}`);
    
    if (endpoint.body) {
      console.log(`   Request Body: ${endpoint.body}`);
    }
    
    if (endpoint.headers) {
      console.log(`   Headers: ${JSON.stringify(endpoint.headers)}`);
    }
    
    console.log(`   Response: ${JSON.stringify(endpoint.response, null, 2)}`);
    console.log('');
  });
  
  console.log('📧 EMAIL CONFIGURATION:\n');
  console.log('To enable email functionality, configure these environment variables:');
  console.log('   SMTP_HOST=smtp.gmail.com');
  console.log('   SMTP_PORT=587');
  console.log('   SMTP_USER=your-email@gmail.com');
  console.log('   SMTP_PASS=your-app-password');
  console.log('   EMAIL_FROM=noreply@yourapp.com');
  console.log('');
  
  console.log('🔧 TESTING STEPS:\n');
  console.log('1. Start the server: bun run dev');
  console.log('2. Register a user: POST /api/auth/register');
  console.log('3. Check verification status: GET /api/auth/email-verification-status');
  console.log('4. (If SMTP configured) Check email for verification link');
  console.log('5. Verify email: POST /api/auth/verify-email');
  console.log('6. Test password reset: POST /api/auth/request-password-reset');
  console.log('');
  
  console.log('🛡️ SECURITY FEATURES:\n');
  console.log('✓ Secure token generation (32-byte random)');
  console.log('✓ Token expiration (24 hours)');
  console.log('✓ One-time use tokens');
  console.log('✓ Constant-time token comparison');
  console.log('✓ Rate limiting ready');
  console.log('✓ HTTPS enforcement for sensitive operations');
  console.log('✓ Secure email templates');
  console.log('✓ Admin user pre-verification');
  console.log('');
  
  console.log('📱 FRONTEND INTEGRATION:\n');
  console.log('Check the frontendExamples object for React/JavaScript examples');
  console.log('');
  
  console.log('🎯 EXAMPLE USAGE:\n');
  console.log('// 1. Register user');
  console.log(`curl -X POST ${testEndpoints.baseUrl}/auth/register \\`);
  console.log('  -H "Content-Type: application/json" \\');
  console.log(`  -d '${JSON.stringify(testEndpoints.examples.register)}'`);
  console.log('');
  console.log('// 2. Verify email');
  console.log(`curl -X POST ${testEndpoints.baseUrl}/auth/verify-email \\`);
  console.log('  -H "Content-Type: application/json" \\');
  console.log('  -d \'{"token": "your-token-from-email"}\'');
  console.log('');
}

// Run the documentation display if this file is executed directly
if (require.main === module) {
  displayApiDocumentation();
}

module.exports = { testEndpoints, displayApiDocumentation };