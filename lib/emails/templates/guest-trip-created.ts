/**
 * Guest Trip Created Email Template
 * 
 * Email sent to guests after they create a trip, encouraging them to sign up.
 */

import { baseTemplate, createButton } from './base-template';
import { GUEST_TRIP_CREATED, EMAIL_FOOTER } from '../content';

export interface GuestTripCreatedParams {
  destination: string;
  signupUrl: string;
}

export function guestTripCreatedTemplate(params: GuestTripCreatedParams): string {
  const benefitsList = GUEST_TRIP_CREATED.benefits
    .map(
      (benefit) => `
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
        <svg style="width: 20px; height: 20px; color: #3ea34b; flex-shrink: 0;" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
        <span style="font-size: 15px; line-height: 1.5; color: #333333;">${benefit}</span>
      </div>
    `
    )
    .join('');

  const body = `
    <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.5; color: #333333;">
      ${GUEST_TRIP_CREATED.greeting}
    </p>
    
    <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.5; color: #333333;">
      ${GUEST_TRIP_CREATED.body(params.destination)}
    </p>
    
    <div style="margin: 0 0 24px 0; padding: 20px; background-color: #f9fafb; border-radius: 8px;">
      ${benefitsList}
    </div>
    
    <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.5; color: #333333; text-align: center;">
      ${GUEST_TRIP_CREATED.freeNote}
    </p>
    
    ${createButton(params.signupUrl, GUEST_TRIP_CREATED.ctaText, 'primary')}
    
    <p style="margin: 24px 0 0 0; padding-top: 20px; border-top: 1px solid #d9d9d9; font-size: 13px; line-height: 1.5; color: #666666;">
      ${GUEST_TRIP_CREATED.note}
    </p>
  `;

  return baseTemplate({
    title: GUEST_TRIP_CREATED.title,
    body,
    footer: EMAIL_FOOTER,
  });
}
