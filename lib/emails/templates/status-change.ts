/**
 * Status Change Email Template
 * 
 * Email sent to driver when trip status changes.
 * Handles 4 variants: cancelled, acceptance request, confirmed, generic.
 */

import { baseTemplate, createStatusBox, createButton } from './base-template';
import { STATUS_CHANGE, EMAIL_FOOTER } from '../content';

export type StatusChangeVariant =
  | 'cancelled'
  | 'acceptanceRequest'
  | 'confirmed'
  | 'generic';

export interface StatusChangeParams {
  variant: StatusChangeVariant;
  tripDate: string;
  tripLink: string;
  newStatus?: string; // For generic variant
}

export function statusChangeTemplate(params: StatusChangeParams): { subject: string; html: string } {
  const { variant, tripDate, tripLink, newStatus } = params;

  let config;
  let emailBody: string;
  let statusDisplay: string;
  let statusColor: string;

  switch (variant) {
    case 'cancelled':
      config = STATUS_CHANGE.cancelled;
      emailBody = `
        <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.5; color: #333333;">
          ${config.greeting}
        </p>
        
        <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.5; color: #333333;">
          ${config.body(tripDate)}
        </p>
        
        <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.5; color: #333333;">
          ${config.note}
        </p>
      `;
      statusDisplay = config.statusDisplay;
      statusColor = config.statusColor;
      break;

    case 'acceptanceRequest':
      config = STATUS_CHANGE.acceptanceRequest;
      emailBody = `
        <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.5; color: #333333;">
          ${config.greeting}
        </p>
        
        <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.5; color: #333333;">
          ${config.body(tripDate)}
        </p>
        
        <div style="background-color: #fff7ed; padding: 20px; border-radius: 6px; margin: 24px 0; border-left: 4px solid ${config.statusColor};">
          <p style="margin: 0 0 8px 0; font-size: 13px; font-weight: 600; color: #666666; text-transform: uppercase; letter-spacing: 0.5px;">
            ${config.actionRequired.label}
          </p>
          <p style="margin: 0; font-size: 16px; font-weight: 600; color: #05060A;">
            ${config.actionRequired.text}
          </p>
        </div>
      `;
      statusDisplay = config.statusDisplay;
      statusColor = config.statusColor;
      break;

    case 'confirmed':
      config = STATUS_CHANGE.confirmed;
      emailBody = `
        <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.5; color: #333333;">
          ${config.greeting}
        </p>
        
        <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.5; color: #333333;">
          ${config.body(tripDate)}
        </p>
        
        <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.5; color: #333333;">
          ${config.note}
        </p>
      `;
      statusDisplay = config.statusDisplay;
      statusColor = config.statusColor;
      break;

    case 'generic':
    default:
      config = STATUS_CHANGE.generic;
      const isConfirmed = newStatus === 'confirmed';
      statusDisplay = isConfirmed ? 'Confirmed' : 'Not Confirmed';
      statusColor = isConfirmed ? '#3ea34b' : '#999999';
      emailBody = `
        <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.5; color: #333333;">
          ${config.greeting}
        </p>
        
        <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.5; color: #333333;">
          ${config.body(tripDate)}
        </p>
      `;
      break;
  }

  const body = `
    ${emailBody}
    
    ${createStatusBox(STATUS_CHANGE.statusLabel, statusDisplay, statusColor)}
    
    ${createButton(tripLink, STATUS_CHANGE.buttonText, 'primary')}
    
    <p style="margin: 24px 0 0 0; padding-top: 20px; border-top: 1px solid #d9d9d9; font-size: 13px; line-height: 1.5; color: #666666;">
      ${STATUS_CHANGE.note}
    </p>
  `;

  let subject: string;
  switch (variant) {
    case 'cancelled':
      subject = STATUS_CHANGE.cancelled.subject(tripDate);
      break;
    case 'acceptanceRequest':
      subject = STATUS_CHANGE.acceptanceRequest.subject(tripDate);
      break;
    case 'confirmed':
      subject = STATUS_CHANGE.confirmed.subject(tripDate);
      break;
    default:
      subject = STATUS_CHANGE.generic.subject(tripDate);
  }

  return {
    subject,
    html: baseTemplate({
      title: config.title,
      body,
      footer: EMAIL_FOOTER,
    }),
  };
}

