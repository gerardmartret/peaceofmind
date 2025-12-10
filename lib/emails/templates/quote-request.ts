/**
 * Quote Request Email Template
 * 
 * Email sent to drivers inviting them to submit a quote.
 */

import { baseTemplate, createButton } from './base-template';
import { QUOTE_REQUEST, EMAIL_FOOTER } from '../content';

export interface QuoteRequestParams {
  tripDate: string;
  tripLink: string;
}

export function quoteRequestTemplate(params: QuoteRequestParams): string {
  const body = `
    <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.5; color: #333333;">
      ${QUOTE_REQUEST.greeting}
    </p>
    
    <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.5; color: #333333;">
      ${QUOTE_REQUEST.body(params.tripDate)}
    </p>
    
    <div style="background-color: #ffffff; padding: 16px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #05060A;">
      <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #333333;">
        <strong style="color: #05060A;">${QUOTE_REQUEST.instructions.title}</strong><br/>
        ${QUOTE_REQUEST.instructions.steps.map((step, i) => `${i + 1}. ${step}`).join('<br/>')}
      </p>
    </div>
    
    ${createButton(params.tripLink, QUOTE_REQUEST.buttonText, 'primary')}
    
    <p style="margin: 24px 0 0 0; padding-top: 20px; border-top: 1px solid #d9d9d9; font-size: 13px; line-height: 1.5; color: #666666;">
      ${QUOTE_REQUEST.note}
    </p>
  `;

  return baseTemplate({
    title: QUOTE_REQUEST.title,
    body,
    footer: EMAIL_FOOTER,
  });
}

