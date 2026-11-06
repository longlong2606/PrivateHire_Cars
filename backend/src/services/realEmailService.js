const nodemailer = require('nodemailer');
const { randomUUID } = require('node:crypto');

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]));

function cleanHeader(value, label) {
  const text = String(value ?? '').trim();
  if (!text || /[\r\n]/.test(text)) throw new Error(`${label} is missing or invalid.`);
  return text;
}

function emailAddress(value, label) {
  const address = cleanHeader(value, label);
  if (!/^[^\s@<>;,]+@[^\s@<>;,]+\.[^\s@<>;,]+$/.test(address)) {
    throw new Error(`${label} must be one valid email address.`);
  }
  return address;
}

function readEmailConfig(env = process.env) {
  const host = cleanHeader(env.SMTP_HOST || 'smtp.gmail.com', 'SMTP_HOST');
  const port = Number(env.SMTP_PORT || 465);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('SMTP_PORT must be an integer from 1 to 65535.');
  }
  const user = emailAddress(env.SMTP_USER, 'SMTP_USER');
  // Google displays app passwords in groups separated by spaces.
  const password = host === 'smtp.gmail.com'
    ? String(env.SMTP_PASS || '').replace(/\s/g, '')
    : String(env.SMTP_PASS || '');
  if (!password || /[\r\n]/.test(password)) {
    throw new Error('SMTP_PASS is required. For Gmail, use an App Password.');
  }
  if (host === 'smtp.gmail.com' && !/^[\x21-\x7E]{16}$/.test(password)) {
    throw new Error('Gmail SMTP_PASS must be the 16-character App Password, not your Gmail login password.');
  }
  const senderName = cleanHeader(env.EMAIL_FROM_NAME || 'PrivateHire Cars', 'EMAIL_FROM_NAME');
  const loginUrl = new URL(env.EMAIL_LOGIN_URL || 'http://localhost:5173/login.html');
  if (!['http:', 'https:'].includes(loginUrl.protocol) || loginUrl.username || loginUrl.password) {
    throw new Error('EMAIL_LOGIN_URL must be an http(s) URL without embedded credentials.');
  }
  return { host, port, user, password, senderName, loginUrl: loginUrl.href };
}

function smtpError(error) {
  // Keep provider diagnostics out of the registration response and never log credentials.
  const code = /^[A-Z0-9_]+$/.test(String(error?.code || '')) ? error.code : 'SMTP_ERROR';
  const failure = new Error(`Confirmation email was not accepted by SMTP (${code}). Check the sender configuration or connection.`);
  failure.code = code;
  return failure;
}

function createRealEmailService({ env = process.env, transportFactory = nodemailer.createTransport } = {}) {
  const config = readEmailConfig(env);
  const transporter = transportFactory({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    requireTLS: config.port !== 465,
    auth: { user: config.user, pass: config.password },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  const emailLog = [];

  // Shared SMTP sender for later booking confirmations, enquiry replies and offers.
  async function sendEmail({ toEmail, subject, text, html }) {
    const recipient = emailAddress(toEmail, 'Recipient');
    const safeSubject = cleanHeader(subject, 'Email subject');
    let result;
    try {
      result = await transporter.sendMail({
        from: { name: config.senderName, address: config.user },
        to: { address: recipient },
        subject: safeSubject,
        text,
        html,
      });
      // SMTP acceptance is evidence of sending, not proof of arrival in the inbox.
      if (!Array.isArray(result.accepted) || result.accepted.length === 0
          || (Array.isArray(result.rejected) && result.rejected.length > 0)) {
        throw Object.assign(new Error('Recipient rejected'), { code: 'ERECIPIENT' });
      }
    } catch (error) {
      throw smtpError(error);
    }

    const record = {
      id: randomUUID(),
      to: recipient,
      subject: safeSubject,
      preview: text,
      html,
      sentAt: new Date().toISOString(),
      status: 'SENT',
      deliveryStatus: 'SMTP_ACCEPTED',
      provider: config.host === 'smtp.gmail.com' ? 'Gmail SMTP' : 'SMTP',
      messageId: result.messageId || null,
    };
    // Preserve the legacy preview/history response shape. Failed attempts are not
    // included because the existing demonstration UI labels every history entry SENT.
    emailLog.unshift(record);
    if (emailLog.length > 100) emailLog.pop();
    return { ...record };
  }

  async function sendConfirmationEmail({ toEmail, name, accountCode, mockCardRef }) {
    const subject = 'Welcome to PrivateHire Cars — registration confirmation';
    const text = [
      `Hello ${name},`, '',
      'Your PrivateHire Cars account has been created successfully.', '',
      `Account code: ${accountCode}`,
      `Registered email: ${toEmail}`,
      `Mock card reference: ${mockCardRef}`,
      '', 'You can now sign in using your registered email and password.',
      `Sign in: ${config.loginUrl}`, '', 'PrivateHire Cars',
    ].join('\n');
    const html = `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#25352e;max-width:600px;margin:auto">
      <h1 style="font-size:24px">Welcome to PrivateHire Cars</h1>
      <p>Hello ${escapeHtml(name)},</p>
      <p>Your account has been created successfully.</p>
      <p><strong>Account code:</strong> ${escapeHtml(accountCode)}<br>
      <strong>Registered email:</strong> ${escapeHtml(toEmail)}<br>
      <strong>Mock card reference:</strong> ${escapeHtml(mockCardRef)}</p>
      <p>You can now sign in using your registered email and password.</p>
      <p><a href="${escapeHtml(config.loginUrl)}">Sign in to PrivateHire Cars</a></p>
      <p>PrivateHire Cars</p>
    </div>`;
    return sendEmail({ toEmail, subject, text, html });
  }

  return {
    sendEmail,
    sendConfirmationEmail,
    getEmailHistory: () => emailLog.map((record) => ({ ...record })),
    verifyConnection: async () => {
      try { return await transporter.verify(); } catch (error) { throw smtpError(error); }
    },
    close: () => { if (typeof transporter.close === 'function') transporter.close(); },
  };
}

module.exports = { createRealEmailService, readEmailConfig };
