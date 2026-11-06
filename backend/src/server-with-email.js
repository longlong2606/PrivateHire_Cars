const { loadEmailEnvironment } = require('./email/loadEmailEnvironment');
const { createRealEmailService } = require('./services/realEmailService');
const { installRegistrationEmail } = require('./email/installRegistrationEmail');

async function start() {
  loadEmailEnvironment();
  const emailService = createRealEmailService();
  // Verify SMTP authentication before exposing a registration endpoint that
  // promises real email. This check does not send any message.
  await emailService.verifyConnection();
  installRegistrationEmail(emailService);
  console.log('[SCRUM-47] Real SMTP email is enabled; sender connection verified.');
  return require('./server');
}

if (require.main === module) {
  start().catch((error) => {
    console.error(`[SCRUM-47] ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { start };
