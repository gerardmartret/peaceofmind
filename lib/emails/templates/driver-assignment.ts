/**
 * Driver Assignment Email Template
 * 
 * Email sent to driver when they are initially assigned to a trip.
 */

import { baseTemplate, createTripInfoBox, createButton } from './base-template';
import {
  DRIVER_ASSIGNMENT,
  TRIP_INFO,
  STATUS_DISPLAY,
  STATUS_COLORS,
} from '../content';

export interface DriverAssignmentParams {
  tripDate: string;
  magicLink: string;
  tripDestination?: string;
  leadPassengerName?: string;
}

export function driverAssignmentTemplate(
  params: DriverAssignmentParams
): string {
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

  if (params.leadPassengerName) {
    infoItems.push({
      label: TRIP_INFO.passenger,
      value: params.leadPassengerName,
    });
  }

  infoItems.push({
    label: TRIP_INFO.status,
    value: STATUS_DISPLAY.awaitingResponse,
    color: STATUS_COLORS.awaitingResponse,
  });

  const body = `
    <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 24px; color: #374151;">
      ${DRIVER_ASSIGNMENT.greeting}
    </p>
    
    <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 24px; color: #374151;">
      ${DRIVER_ASSIGNMENT.body}
    </p>
    
    ${createTripInfoBox(infoItems)}
    
    ${createButton(params.magicLink, DRIVER_ASSIGNMENT.linkText, 'success')}
    
    <p style="margin: 24px 0 0 0; font-size: 13px; line-height: 20px; color: #6b7280;">
      ${DRIVER_ASSIGNMENT.linkNote}
    </p>
  `;

  return baseTemplate({
    title: DRIVER_ASSIGNMENT.title,
    body,
    variant: 'border',
  });
}

