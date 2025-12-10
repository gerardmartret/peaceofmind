/**
 * Booking Request Email Template
 * 
 * Email sent to Drivania when a booking request is submitted.
 */

import { baseTemplate } from './base-template';
import { BOOKING_REQUEST, EMAIL_FOOTER } from '../content';

export interface BookingRequestParams {
  formattedPayload: string;
}

export function bookingRequestTemplate(
  params: BookingRequestParams
): string {
  const body = `
    <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.5; color: #333333;">
      ${BOOKING_REQUEST.body}
    </p>
    
    <div style="background-color: #ffffff; padding: 20px; border-radius: 6px; margin: 16px 0; border: 1px solid #d9d9d9;">
      <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #05060A;">${BOOKING_REQUEST.detailsTitle}</h3>
      <pre style="margin: 0; font-family: 'Courier New', monospace; font-size: 13px; color: #333333; white-space: pre-wrap; word-wrap: break-word; background-color: #f9f9f9; padding: 16px; border-radius: 4px; overflow-x: auto;">${params.formattedPayload}</pre>
    </div>
    
    <p style="margin: 24px 0 0 0; padding-top: 20px; border-top: 1px solid #d9d9d9; font-size: 13px; line-height: 1.5; color: #666666;">
      ${BOOKING_REQUEST.note}
    </p>
  `;

  return baseTemplate({
    title: BOOKING_REQUEST.title,
    body,
    footer: EMAIL_FOOTER,
  });
}

