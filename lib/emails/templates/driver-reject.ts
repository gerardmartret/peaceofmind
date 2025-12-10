/**
 * Driver Reject Email Template
 * 
 * Email sent to trip owner when driver rejects a trip assignment.
 */

import { baseTemplate, createTripInfoBox, createButton } from './base-template';
import { DRIVER_REJECT, TRIP_INFO, STATUS_COLORS } from '../content';

export interface DriverRejectParams {
  tripDate: string;
  tripLink: string;
  driverEmail: string;
  tripDestination?: string;
}

export function driverRejectTemplate(params: DriverRejectParams): string {
  const infoItems: Array<{ label: string; value: string; color?: string }> = [
    {
      label: TRIP_INFO.date,
      value: params.tripDate,
    },
  ];

  if (params.tripDestination) {
    infoItems.push({
      label: TRIP_INFO.destination,
      value: params.tripDestination,
    });
  }

  infoItems.push({
    label: TRIP_INFO.status,
    value: 'Rejected',
    color: STATUS_COLORS.rejected,
  });

  const body = `
    <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 24px; color: #374151;">
      ${DRIVER_REJECT.body(params.driverEmail)}
    </p>
    
    ${createTripInfoBox(infoItems)}
    
    <p style="margin: 24px 0; font-size: 15px; line-height: 24px; color: #374151;">
      ${DRIVER_REJECT.note}
    </p>
    
    ${createButton(params.tripLink, DRIVER_REJECT.buttonText, 'success')}
  `;

  return baseTemplate({
    title: DRIVER_REJECT.title,
    body,
    variant: 'border',
  });
}

