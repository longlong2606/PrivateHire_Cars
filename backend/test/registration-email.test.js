const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');
const { newDb } = require('pg-mem');
const { createRealEmailService, readEmailConfig } = require('../src/services/realEmailService');
const { installRegistrationEmail } = require('../src/email/installRegistrationEmail');

const testEnvironment = {
  SMTP_USER: 'sender@example.test',
  SMTP_PASS: 'abcd efgh ijkl mnop',
  EMAIL_LOGIN_URL: 'http://localhost:5173/login.html',
};
const messages = [];
const smtpSockets = new Set();
let smtpServer;
let httpServer;
let pool;
let emailService;
let baseUrl;
let firstAccount;

// A loopback-only SMTP receiver: no external service, inbox or credentials are used.
async function startTestSmtp() {
  const server = net.createServer((socket) => {
    smtpSockets.add(socket);
    socket.once('close', () => smtpSockets.delete(socket));
    socket.setEncoding('utf8');
    let buffer = '';
    let inData = false;
    let content = [];
    let recipients = [];
    socket.write('220 localhost test SMTP ready\r\n');
    socket.on('data', (chunk) => {
      buffer += chunk;
      let newline;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newline).replace(/\r$/, '');
        buffer = buffer.slice(newline + 1);
        if (inData) {
          if (line === '.') {
            messages.push({ recipients: [...recipients], content: content.join('\r\n') });
            inData = false;
            socket.write('250 2.0.0 message accepted\r\n');
          } else {
            content.push(line.replace(/^\.\./, '.'));
          }
          continue;
        }
        if (/^(EHLO|HELO) /i.test(line)) {
          socket.write('250-localhost\r\n250 SIZE 1048576\r\n');
        } else if (/^MAIL FROM:/i.test(line)) {
          recipients = [];
          socket.write('250 2.1.0 sender accepted\r\n');
        } else if (/^RCPT TO:/i.test(line)) {
          if (line.includes('delivery-failure@example.test')) {
            socket.write('550 5.1.1 recipient rejected for this test\r\n');
          } else {
            recipients.push(line);
            socket.write('250 2.1.5 recipient accepted\r\n');
          }
        } else if (/^DATA$/i.test(line)) {
          content = [];
          inData = true;
          socket.write('354 end with a dot\r\n');
        } else if (/^QUIT$/i.test(line)) {
          socket.end('221 goodbye\r\n');
        } else if (/^(RSET|NOOP)$/i.test(line)) {
          socket.write('250 OK\r\n');
        } else {
          socket.write('502 unsupported test command\r\n');
        }
      }
    });
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return server;
}

function validRegistration(overrides = {}) {
  return {
    name: 'Email Test Customer',
    email: 'registration-success@example.test',
    address: '10 Test Street, London',
    telephone: '07123456789',
    password: 'ExamplePassword123!',
    confirmPassword: 'ExamplePassword123!',
    mockCardRef: 'MOCK_VISA_4242',
    ...overrides,
  };
}

async function register(body) {
  const response = await fetch(`${baseUrl}/api/accounts/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

before(async () => {
  smtpServer = await startTestSmtp();
  const database = newDb();
  const { Pool } = database.adapters.createPg();
  pool = new Pool();
  await pool.query(fs.readFileSync(path.join(__dirname, '../src/database/schema.sql'), 'utf8'));
  // Redirect only this test process's database abstraction to an isolated database.
  // The unchanged model still executes its real INSERT and SELECT SQL statements.
  const db = require('../src/config/db');
  db.query = (sql, parameters) => pool.query(sql, parameters);

  emailService = createRealEmailService({
    env: testEnvironment,
    transportFactory: () => nodemailer.createTransport({
      host: '127.0.0.1',
      port: smtpServer.address().port,
      secure: false,
      ignoreTLS: true, // Only this isolated test transport; production requires TLS.
      connectionTimeout: 2000,
      greetingTimeout: 2000,
      socketTimeout: 2000,
    }),
  });
  installRegistrationEmail(emailService);
  const app = express();
  app.use(express.json());
  app.use('/api/accounts', require('../src/routes/accountRoutes'));
  httpServer = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  baseUrl = `http://127.0.0.1:${httpServer.address().port}`;
});

after(async () => {
  emailService?.close();
  if (httpServer) {
    httpServer.closeAllConnections();
    await new Promise((resolve) => httpServer.close(resolve));
  }
  for (const socket of smtpSockets) socket.destroy();
  if (smtpServer) await new Promise((resolve) => smtpServer.close(resolve));
  if (pool) await pool.end();
});

test('Gmail settings use TLS, sender address and the normalised App Password', () => {
  let options;
  createRealEmailService({ env: testEnvironment, transportFactory: (value) => { options = value; return {}; } });
  assert.equal(options.host, 'smtp.gmail.com');
  assert.equal(options.port, 465);
  assert.equal(options.secure, true);
  assert.equal(options.auth.pass, 'abcdefghijklmnop');
  assert.equal(options.disableFileAccess, true);
  assert.equal(options.disableUrlAccess, true);
});

test('missing credentials and invalid port fail clearly', () => {
  assert.throws(() => readEmailConfig({}), /SMTP_USER/);
  assert.throws(() => readEmailConfig({ ...testEnvironment, SMTP_PASS: '' }), /SMTP_PASS/);
  assert.throws(() => readEmailConfig({ ...testEnvironment, SMTP_PORT: 'not-a-port' }), /SMTP_PORT/);
});

test('SMTP authentication failures do not expose provider details or credentials', async () => {
  const service = createRealEmailService({
    env: testEnvironment,
    transportFactory: () => ({ verify: async () => {
      throw Object.assign(new Error('sensitive provider response abcdefghijklmnop'), { code: 'EAUTH' });
    } }),
  });
  await assert.rejects(service.verifyConnection(), (error) => {
    assert.match(error.message, /EAUTH/);
    assert.doesNotMatch(error.message, /sensitive|abcdefghijklmnop/);
    return true;
  });
});

test('SMTP verification connects without sending any message', async () => {
  const previousCount = messages.length;
  assert.equal(await emailService.verifyConnection(), true);
  assert.equal(messages.length, previousCount);
});

test('valid original registration saves a hashed account and sends one real SMTP message', async () => {
  const beforeCount = messages.length;
  const result = await register(validRegistration());
  assert.equal(result.status, 201);
  assert.equal(result.body.success, true);
  assert.equal(result.body.emailSent, true);
  assert.equal(messages.length, beforeCount + 1);
  assert.match(messages.at(-1).recipients[0], /registration-success@example\.test/);
  assert.equal(result.body.emailPreview.deliveryStatus, 'SMTP_ACCEPTED');
  assert.ok(result.body.emailPreview.messageId);
  assert.match(result.body.emailPreview.preview, /account has been created successfully/);
  assert.match(result.body.emailPreview.preview, /4242/);
  assert.doesNotMatch(result.body.emailPreview.preview, /ExamplePassword123/);
  assert.match(result.body.emailPreview.html, /login\.html/);
  const saved = await pool.query('SELECT * FROM accounts WHERE email = $1', [result.body.account.email]);
  firstAccount = saved.rows[0];
  assert.ok(await bcrypt.compare(validRegistration().password, firstAccount.password_hash));
  assert.equal(firstAccount.mock_card_ref, result.body.account.mockCardRef);
  assert.equal(firstAccount.account_code, result.body.account.accountCode);
});

test('duplicate registration sends no additional confirmation or database row', async () => {
  const beforeCount = messages.length;
  const result = await register(validRegistration({ email: 'REGISTRATION-SUCCESS@example.test' }));
  assert.equal(result.status, 400);
  assert.equal(messages.length, beforeCount);
  const saved = await pool.query('SELECT * FROM accounts WHERE LOWER(email) = LOWER($1)', ['registration-success@example.test']);
  assert.equal(saved.rows.length, 1);
});

for (const [title, changes] of [
  ['missing required information', { name: '' }],
  ['invalid email', { email: 'not-an-email' }],
  ['password mismatch', { confirmPassword: 'different-password' }],
]) {
  test(`${title} is still rejected by the original validation without sending email`, async () => {
    const beforeCount = messages.length;
    const result = await register(validRegistration(changes));
    assert.equal(result.status, 400);
    assert.equal(result.body.success, false);
    assert.equal(messages.length, beforeCount);
  });
}

test('customer names are escaped in HTML confirmation content', async () => {
  const result = await register(validRegistration({ email: 'html-escape@example.test', name: '<script>example()</script>' }));
  assert.equal(result.status, 201);
  assert.match(result.body.emailPreview.html, /&lt;script&gt;example\(\)&lt;\/script&gt;/);
  assert.doesNotMatch(result.body.emailPreview.html, /<script>/);
});

test('SMTP rejection preserves the account and reports delivery failure to the unchanged frontend', async () => {
  const beforeCount = messages.length;
  const result = await register(validRegistration({ email: 'delivery-failure@example.test' }));
  assert.equal(result.status, 502);
  assert.equal(result.body.success, false);
  assert.equal(result.body.accountCreated, true);
  assert.equal(result.body.emailSent, false);
  assert.equal(result.body.emailPreview, null);
  assert.equal(result.body.code, 'REGISTRATION_EMAIL_FAILED');
  assert.match(result.body.message, /account was created/);
  assert.equal(messages.length, beforeCount);
  const saved = await pool.query('SELECT * FROM accounts WHERE email = $1', ['delivery-failure@example.test']);
  assert.equal(saved.rows.length, 1);
  assert.ok(await bcrypt.compare(validRegistration().password, saved.rows[0].password_hash));
  assert.ok(emailService.getEmailHistory().every((entry) => entry.to !== 'delivery-failure@example.test'));
});

test('the shared sender can send a non-registration message using the same transport', async () => {
  const record = await emailService.sendEmail({
    toEmail: 'shared-sender@example.test',
    subject: 'Shared sender test',
    text: 'Reusable email service for later coursework stories.',
    html: '<p>Reusable email service.</p>',
  });
  assert.equal(record.deliveryStatus, 'SMTP_ACCEPTED');
  assert.equal(messages.at(-1).content.includes('Shared sender test'), true);
});

test('the existing history endpoint contains only SMTP-accepted messages and returns copies', async () => {
  const response = await fetch(`${baseUrl}/api/accounts/emails`);
  const result = await response.json();
  assert.equal(result.success, true);
  assert.equal(result.data.length, messages.length);
  assert.ok(result.data.every((record) => record.status === 'SENT' && record.deliveryStatus === 'SMTP_ACCEPTED'));
  const snapshot = emailService.getEmailHistory();
  snapshot[0].status = 'changed by consumer';
  assert.equal(emailService.getEmailHistory()[0].status, 'SENT');
});

test('mailbox validation prevents multiple recipients or header injection', async () => {
  const beforeCount = messages.length;
  await assert.rejects(emailService.sendEmail({
    toEmail: 'one@example.test,two@example.test', subject: 'test', text: 'test', html: '<p>test</p>',
  }), /one valid email/);
  await assert.rejects(emailService.sendEmail({
    toEmail: 'one@example.test', subject: 'test\r\nBcc: another@example.test', text: 'test', html: '<p>test</p>',
  }), /Email subject/);
  assert.equal(messages.length, beforeCount);
});
