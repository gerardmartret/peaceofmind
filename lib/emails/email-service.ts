/**
 * Email Service
 * 
 * Centralized service for sending email notifications via Resend.
 * Provides consistent error handling and API interaction.
 */

import { Resend } from 'resend';
import { EMAIL_FROM } from './content';

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export interface SendEmailResult {
  success: boolean;
  emailId?: string;
  error?: string;
}

let resendInstance: Resend | null = null;

/**
 * Initializes Resend client (singleton pattern)
 */
function getResendClient(): Resend | null {
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!resendApiKey) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ RESEND_API_KEY not configured, email sending disabled');
    }
    return null;
  }

  if (!resendInstance) {
    resendInstance = new Resend(resendApiKey);
  }

  return resendInstance;
}

/**
 * Sends an email via Resend
 * 
 * @param params - Email parameters
 * @returns Result with success status and optional email ID or error
 */
export async function sendEmail(
  params: SendEmailParams
): Promise<SendEmailResult> {
  try {
    const resend = getResendClient();

    if (!resend) {
      return {
        success: false,
        error: 'Email service not configured (RESEND_API_KEY missing)',
      };
    }

    const recipients = Array.isArray(params.to) ? params.to : [params.to];

    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: recipients,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });

    if (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Error sending email:', error);
      }
      return {
        success: false,
        error: error.message || 'Failed to send email',
      };
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ Email sent successfully to ${recipients.join(', ')}`);
    }

    return {
      success: true,
      emailId: data?.id,
    };
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('❌ Error in sendEmail:', error);
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Checks if email service is configured
 */
export function isEmailServiceConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

