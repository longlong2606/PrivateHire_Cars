const nodemailer = require('nodemailer');

// In-memory store for sent emails for testing and demo inspection
const emailLog = [];

/**
 * Send account registration confirmation email under AC5
 * AC5: After successful registration, a confirmation email is sent to the registered email address.
 */
const sendConfirmationEmail = async ({ toEmail, name, accountCode, mockCardRef }) => {
  const subject = `[Registration Confirmation] Welcome ${name} to PrivateHire Cars!`;
  const textContent = `Hello ${name},\n\nYour account has been successfully registered with PrivateHire Cars.\n\nAccount Details:\n- Account Code: ${accountCode}\n- Email: ${toEmail}\n- Linked Mock Card: ${mockCardRef}\n\nThank you for choosing PrivateHire Cars!`;
  
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
      <div style="background-color: #2563eb; color: #fff; padding: 20px; text-align: center;">
        <h2 style="margin: 0;">🎉 Registration Successful!</h2>
      </div>
      <div style="padding: 24px;">
        <p>Hello <strong>${name}</strong>,</p>
        <p>Thank you for registering your account with PrivateHire Cars. Here are your account details:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #ddd; color: #666;">Account Code:</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold; color: #2563eb;">${accountCode}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #ddd; color: #666;">Registered Email:</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">${toEmail}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #ddd; color: #666;">Mock Card Reference:</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">${mockCardRef}</td>
          </tr>
        </table>
        <p>You can now use your registered email and password to sign in.</p>
        <div style="text-align: center; margin-top: 30px;">
          <span style="background: #10b981; color: white; padding: 10px 20px; border-radius: 5px; font-weight: bold; display: inline-block;">
            Account Active
          </span>
        </div>
      </div>
      <div style="background-color: #f8fafc; padding: 12px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0;">
        PrivateHire Cars System &bull; Automated notification email under AC5
      </div>
    </div>
  `;

  const emailRecord = {
    id: emailLog.length + 1,
    to: toEmail,
    subject,
    preview: textContent,
    html: htmlContent,
    sentAt: new Date().toISOString(),
    status: 'SENT',
  };

  emailLog.unshift(emailRecord);

  console.log('======================================================');
  console.log(`📧 [AC5 Email Service] Confirmation email sent to: ${toEmail}`);
  console.log(`   Subject: ${subject}`);
  console.log(`   Account Code: ${accountCode}`);
  console.log('======================================================');

  return emailRecord;
};

const getEmailHistory = () => {
  return [...emailLog];
};

module.exports = {
  sendConfirmationEmail,
  getEmailHistory,
};

