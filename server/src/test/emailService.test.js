const emailService = require('../services/emailService');

/**
 * Simple test for email service functionality
 * This is a basic test to verify the email service works correctly
 */

async function testEmailService() {
  console.log('Testing Email Service...\n');

  try {
    // Test 1: Service initialization
    console.log('1. Testing service initialization...');
    const isAvailable = emailService.isAvailable();
    console.log(`   Email service available: ${isAvailable ? 'YES' : 'NO'}`);
    
    if (!isAvailable) {
      console.log('   Note: Email service not configured - this is expected in development');
    }

    // Test 2: Token generation
    console.log('\n2. Testing token generation...');
    const testEmail = 'test@example.com';
    const tokenData = emailService.generateVerificationToken(testEmail, 'email_verification');
    console.log(`   Generated token: ${tokenData.token.substring(0, 8)}...`);
    console.log(`   Token expires: ${tokenData.expiresAt}`);

    // Test 3: Token verification
    console.log('\n3. Testing token verification...');
    const verifiedToken = emailService.verifyToken(tokenData.token, 'email_verification');
    console.log(`   Token verification: ${verifiedToken ? 'VALID' : 'INVALID'}`);
    console.log(`   Token email: ${verifiedToken?.email}`);
    console.log(`   Token type: ${verifiedToken?.type}`);

    // Test 4: Token usage
    console.log('\n4. Testing token usage...');
    emailService.markTokenAsUsed(tokenData.token);
    const usedToken = emailService.verifyToken(tokenData.token, 'email_verification');
    console.log(`   Used token verification: ${usedToken ? 'VALID' : 'INVALID (expected)'}`);

    // Test 5: Token statistics
    console.log('\n5. Testing token statistics...');
    const stats = emailService.getTokenStats();
    console.log(`   Total tokens: ${stats.total}`);
    console.log(`   Active tokens: ${stats.active}`);
    console.log(`   Used tokens: ${stats.used}`);
    console.log(`   Expired tokens: ${stats.expired}`);

    // Test 6: Invalid token
    console.log('\n6. Testing invalid token...');
    const invalidToken = emailService.verifyToken('invalid-token', 'email_verification');
    console.log(`   Invalid token verification: ${invalidToken ? 'VALID' : 'INVALID (expected)'}`);

    console.log('\n✅ Email service tests completed successfully!');

  } catch (error) {
    console.error('\n❌ Email service test failed:', error.message);
    process.exit(1);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testEmailService();
}

module.exports = { testEmailService };