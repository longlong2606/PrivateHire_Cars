function installRegistrationEmail(emailService) {
  // The original controller destructures these functions at load time. Install
  // the new implementation before loading it; all original files remain intact.
  const controllerPath = require.resolve('../controllers/accountController');
  if (require.cache[controllerPath]) {
    throw new Error('Install real email before the account controller is loaded. Use server-with-email.js.');
  }
  const existingService = require('../services/emailService');
  existingService.sendConfirmationEmail = emailService.sendConfirmationEmail;
  existingService.getEmailHistory = emailService.getEmailHistory;

  const controller = require(controllerPath);
  const originalRegister = controller.register;
  controller.register = async (req, res, next) => {
    const originalJson = res.json;
    res.json = function registrationResult(body) {
      // The old frontend assumes every 201 response means email was sent.
      // Return a clear partial-failure result without deleting the saved account.
      if (res.statusCode === 201 && body?.success && body.emailSent === false) {
        return originalJson.call(res.status(502), {
          ...body,
          success: false,
          accountCreated: true,
          code: 'REGISTRATION_EMAIL_FAILED',
          message: 'Your account was created, but its confirmation email could not be sent. You can sign in with this account. Ask the team to check email delivery; do not register the same email again.',
        });
      }
      return originalJson.call(this, body);
    };
    return originalRegister(req, res, next);
  };
  return controller;
}

module.exports = { installRegistrationEmail };
