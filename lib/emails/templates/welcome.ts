/**
 * Welcome Email Template
 * 
 * Email sent to new users after they confirm their email address.
 */

import { baseTemplate, createButton } from './base-template';
import { WELCOME, EMAIL_FOOTER } from '../content';

export interface WelcomeParams {
  homePageUrl: string;
}

export function welcomeTemplate(params: WelcomeParams): string {
  const body = `
    <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.5; color: #333333;">
      ${WELCOME.greeting}
    </p>
    
    <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.5; color: #333333;">
      ${WELCOME.body}
    </p>
    
    ${createButton(params.homePageUrl, WELCOME.ctaText, 'primary')}
    
    <p style="margin: 24px 0 0 0; padding-top: 20px; border-top: 1px solid #d9d9d9; font-size: 13px; line-height: 1.5; color: #666666;">
      ${WELCOME.note}
    </p>
  `;

  return baseTemplate({
    title: WELCOME.title,
    body,
    footer: EMAIL_FOOTER,
  });
}
