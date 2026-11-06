const { loadEmailEnvironment } = require('./src/email/loadEmailEnvironment');
const { createRealEmailService } = require('./src/services/realEmailService');

async function verify() {
  loadEmailEnvironment();
  const service = createRealEmailService();
  try {
    await service.verifyConnection();
    console.log('SMTP connection and authentication succeeded. No email was sent.');
  } finally {
    service.close();
  }
}

verify().catch((error) => {
  console.error(`SMTP verification failed: ${error.message}`);
  process.exitCode = 1;
});
