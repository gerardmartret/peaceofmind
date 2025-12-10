/**
 * Driver Response Email Template
 * 
 * Email sent to trip owner when driver confirms or rejects a trip.
 */

import { baseTemplate, createButton, createTripInfoBox } from './base-template';
import { DRIVER_RESPONSE, EMAIL_FOOTER } from '../content';

export type DriverResponseType = 'confirmed' | 'rejected';

export interface DriverResponseParams {
  type: DriverResponseType;
  destination: string;
  driverEmail: string;
  tripLink: string;
}

export function driverResponseTemplate(params: DriverResponseParams): string {
  const { type, destination, driverEmail, tripLink } = params;
  const config = DRIVER_RESPONSE[type];

  const infoItems: Array<{ label: string; value: string; color?: string }> = [
    {
      label: 'Driver:',
      value: driverEmail,
    },
    {
      label: config.statusLabel,
      value: config.statusValue,
      color: config.statusColor,
    },
  ];

  const body = `
    <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.5; color: #333333;">
      ${config.body(destination)}
    </p>
    
    ${createTripInfoBox(infoItems)}
    
    ${createButton(tripLink, DRIVER_RESPONSE.ctaText, 'primary')}
    
    ${type === 'rejected' ? `<p style="margin: 24px 0 0 0; padding-top: 20px; border-top: 1px solid #d9d9d9; font-size: 13px; line-height: 1.5; color: #666666;">${DRIVER_RESPONSE.note}</p>` : ''}
  `;

  return baseTemplate({
    title: config.title(destination),
    body,
    footer: EMAIL_FOOTER,
  });
}
