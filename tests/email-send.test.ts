import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sent: Record<string, unknown>[] = [];
const transports: Record<string, unknown>[] = [];
let failNext = false;

vi.mock('nodemailer', () => ({
  default: {
    createTransport: (options: Record<string, unknown>) => {
      transports.push(options);
      return {
        sendMail: async (mail: Record<string, unknown>) => {
          if (failNext) {
            failNext = false;
            throw new Error('Invalid login: 535-5.7.8 Username and Password not accepted');
          }
          sent.push(mail);
          return { messageId: '<1@gmail>' };
        },
      };
    },
  },
}));

const { mailer, sendEmail } = await import('@/lib/email/send');

const VARS = ['RESEND_API_KEY', 'EMAIL_FROM', 'EMAIL_REPLY_TO', 'GMAIL_USER', 'GMAIL_APP_PASSWORD'];
const msg = { to: 'ana@example.com', subject: 'Order RST-1 confirmed', html: '<p>Hi</p>', text: 'Hi' };

beforeEach(() => {
  sent.length = 0;
  transports.length = 0;
  failNext = false;
  for (const v of VARS) delete process.env[v];
});
afterEach(() => {
  for (const v of VARS) delete process.env[v];
});

describe('mailer', () => {
  it('is off until one is configured', () => {
    expect(mailer()).toBeNull();
    process.env.GMAIL_USER = 'resistbcd@gmail.com';
    expect(mailer()).toBeNull();
  });

  it('uses Gmail with an account and app password', () => {
    process.env.GMAIL_USER = 'resistbcd@gmail.com';
    process.env.GMAIL_APP_PASSWORD = 'abcd efgh ijkl mnop';
    expect(mailer()).toBe('gmail');
  });

  it('prefers Resend once it is set up', () => {
    process.env.GMAIL_USER = 'resistbcd@gmail.com';
    process.env.GMAIL_APP_PASSWORD = 'abcdefghijklmnop';
    process.env.RESEND_API_KEY = 're_live';
    process.env.EMAIL_FROM = 'RESIST <orders@resist.ph>';
    expect(mailer()).toBe('resend');
  });
});

describe('sending through Gmail', () => {
  beforeEach(() => {
    process.env.GMAIL_USER = ' resistbcd@gmail.com ';
    process.env.GMAIL_APP_PASSWORD = 'abcd efgh ijkl mnop';
  });

  it('signs in over TLS with the app password, spaces removed', async () => {
    expect(await sendEmail(msg)).toBe(true);
    expect(transports[0]).toMatchObject({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: 'resistbcd@gmail.com', pass: 'abcdefghijklmnop' },
    });
  });

  it('sends from the Gmail account as RESIST, with the reply-to if set', async () => {
    process.env.EMAIL_REPLY_TO = 'hello@resist.ph';
    await sendEmail(msg);
    expect(sent[0]).toEqual({
      from: { name: 'RESIST', address: 'resistbcd@gmail.com' },
      to: 'ana@example.com',
      subject: 'Order RST-1 confirmed',
      html: '<p>Hi</p>',
      text: 'Hi',
      replyTo: 'hello@resist.ph',
    });
  });

  it('throws when Gmail rejects the login, so the order email is retried later', async () => {
    failNext = true;
    await expect(sendEmail(msg)).rejects.toThrow(/Username and Password not accepted/);
  });
});
