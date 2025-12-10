/**
 * Booking Confirmation Email Template
 * 
 * Email sent to trip owner when they successfully book a trip with Drivania.
 */

import { baseTemplate, createButton } from './base-template';
import { BOOKING_CONFIRMATION, EMAIL_FOOTER } from '../content';

export interface BookingConfirmationParams {
  destination: string;
  homePageUrl: string;
}

export function bookingConfirmationTemplate(
  params: BookingConfirmationParams
): string {
  const { destination, homePageUrl } = params;

  const body = `
    <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.5; color: #333333;">
      ${BOOKING_CONFIRMATION.greeting}
    </p>
    
    <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.5; color: #333333;">
      ${BOOKING_CONFIRMATION.body}
    </p>
    
    ${createButton(homePageUrl, BOOKING_CONFIRMATION.ctaText, 'primary')}
    
    <p style="margin: 24px 0 0 0; padding-top: 20px; border-top: 1px solid #d9d9d9; font-size: 13px; line-height: 1.5; color: #666666;">
      ${BOOKING_CONFIRMATION.note}
    </p>
  `;

  return baseTemplate({
    title: BOOKING_CONFIRMATION.title(destination),
    body,
    footer: EMAIL_FOOTER,
  });
}
