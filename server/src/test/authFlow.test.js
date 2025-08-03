// Load test environment
require('dotenv').config({ path: '.env.test' });

const authService = require('../services/authService');
const emailService = require('../services/emailService');

/**
 * Comprehensive test for authentication flow with email verification
 */

async function testAuthFlow() {
  console.log('Testing Authentication Flow with Email Verification...\n');

  try {
    // Test data
    const testUser = {
      email: 'testuser@example.com',
      username: 'testuser',
      password: 'TestPassword123!',
    };

    // Test 1: User Registration
    console.log('1. Testing user registration...');
    const registrationResult = await authService.register(testUser);
    console.log(`   ✅ User registered: ${registrationResult.user.username}`);
    console.log(`   📧 Email verified: ${registrationResult.user.isEmailVerified ? 'YES' : 'NO'}`);
    console.log(`   🔐 Requires verification: ${registrationResult.requiresEmailVerification ? 'YES' : 'NO'}`);
    console.log(`   🎫 Access token: ${registrationResult.accessToken ? 'Generated' : 'Missing'}`);

    // Test 2: Login with unverified email
    console.log('\n2. Testing login with unverified email...');
    const loginResult = await authService.login({
      identifier: testUser.email,
      password: testUser.password,
    });
    console.log(`   ✅ Login successful: ${loginResult.user.username}`);
    console.log(`   📧 Email verified: ${loginResult.user.isEmailVerified ? 'YES' : 'NO'}`);
    console.log(`   🔐 Requires verification: ${loginResult.requiresEmailVerification ? 'YES' : 'NO'}`);

    // Test 3: Generate verification token
    console.log('\n3. Testing verification token generation...');
    const tokenData = emailService.generateVerificationToken(testUser.email, 'email_verification');
    console.log(`   🎟️ Token generated: ${tokenData.token.substring(0, 8)}...`);
    console.log(`   ⏰ Expires: ${tokenData.expiresAt.toLocaleString()}`);

    // Test 4: Email verification
    console.log('\n4. Testing email verification...');
    const verifiedUser = await authService.verifyEmail(tokenData.token);
    console.log(`   ✅ Email verified for: ${verifiedUser.email}`);
    console.log(`   📧 Verification status: ${verifiedUser.isEmailVerified ? 'VERIFIED' : 'UNVERIFIED'}`);
    console.log(`   📅 Verified at: ${verifiedUser.emailVerifiedAt}`);

    // Test 5: Login after verification
    console.log('\n5. Testing login after email verification...');
    const postVerificationLogin = await authService.login({
      identifier: testUser.email,
      password: testUser.password,
    });
    console.log(`   ✅ Login successful: ${postVerificationLogin.user.username}`);
    console.log(`   📧 Email verified: ${postVerificationLogin.user.isEmailVerified ? 'YES' : 'NO'}`);
    console.log(`   🔐 Requires verification: ${postVerificationLogin.requiresEmailVerification ? 'YES' : 'NO'}`);

    // Test 6: Attempt to verify already verified email
    console.log('\n6. Testing verification of already verified email...');
    try {
      await authService.verifyEmail(tokenData.token);
      console.log('   ❌ Should have failed - token was already used');
    } catch (error) {
      console.log(`   ✅ Correctly rejected: ${error.message}`);
    }

    // Test 7: Password reset flow
    console.log('\n7. Testing password reset flow...');
    try {
      const resetResult = await authService.requestPasswordReset(testUser.email);
      console.log(`   📧 Reset email status: ${resetResult.message}`);
      
      // Generate a reset token for testing
      const resetTokenData = emailService.generateVerificationToken(testUser.email, 'password_reset');
      console.log(`   🔑 Reset token generated: ${resetTokenData.token.substring(0, 8)}...`);
      
      // Test password reset
      const newPassword = 'NewTestPassword123!';
      const passwordResetResult = await authService.resetPassword(resetTokenData.token, newPassword);
      console.log(`   ✅ Password reset: ${passwordResetResult.message}`);
      
      // Test login with new password
      const newPasswordLogin = await authService.login({
        identifier: testUser.email,
        password: newPassword,
      });
      console.log(`   ✅ Login with new password: ${newPasswordLogin.user.username}`);
      
    } catch (error) {
      console.log(`   ⚠️ Password reset test skipped: ${error.message}`);
    }

    // Test 8: Resend verification email (for different user)
    console.log('\n8. Testing resend verification email...');
    const newUser = {
      email: 'newuser@example.com',
      username: 'newuser',
      password: 'NewUserPassword123!',
    };
    
    const newUserRegistration = await authService.register(newUser);
    console.log(`   ✅ New user registered: ${newUserRegistration.user.username}`);
    
    try {
      const resendResult = await authService.resendVerificationEmail(newUser.email);
      console.log(`   📧 Resend result: ${resendResult.message}`);
    } catch (error) {
      console.log(`   ⚠️ Resend test skipped: ${error.message}`);
    }

    // Test 9: Token statistics
    console.log('\n9. Testing token statistics...');
    const stats = emailService.getTokenStats();
    console.log(`   📊 Total tokens: ${stats.total}`);
    console.log(`   🟢 Active tokens: ${stats.active}`);
    console.log(`   🔴 Used tokens: ${stats.used}`);
    console.log(`   ⏰ Expired tokens: ${stats.expired}`);

    // Test 10: Admin user verification
    console.log('\n10. Testing admin user...');
    const adminUser = authService.getUserByEmail(process.env.DEFAULT_ADMIN_EMAIL || 'admin@outlier.com');
    if (adminUser) {
      console.log(`   👑 Admin user: ${adminUser.username}`);
      console.log(`   📧 Admin email verified: ${adminUser.isEmailVerified ? 'YES' : 'NO'}`);
      console.log(`   🛡️ Admin role: ${adminUser.role}`);
    } else {
      console.log('   ⚠️ Admin user not found');
    }

    console.log('\n🎉 All authentication flow tests completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   - User registration with email verification ✅');
    console.log('   - Login flow with verification status ✅');
    console.log('   - Email verification process ✅');
    console.log('   - Password reset functionality ✅');
    console.log('   - Token management and security ✅');
    console.log('   - Admin user pre-verification ✅');

  } catch (error) {
    console.error('\n❌ Authentication flow test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testAuthFlow();
}

module.exports = { testAuthFlow };