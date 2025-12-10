/**
 * Driver Unassignment Email Template
 * 
 * Email sent to driver when they are unassigned from a trip.
 */

import { baseTemplate, createTripInfoBox } from './base-template';
import {
  DRIVER_UNASSIGNMENT,
  TRIP_INFO,
  STATUS_DISPLAY,
  STATUS_COLORS,
} from '../content';

export interface DriverUnassignmentParams {
  tripDate: string;
  tripDestination?: string;
  leadPassengerName?: string;
}

export function driverUnassignmentTemplate(
  params: DriverUnassignmentParams
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
    value: STATUS_DISPLAY.unassigned,
    color: STATUS_COLORS.unassigned,
  });

  const body = `
    <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 24px; color: #374151;">
      ${DRIVER_UNASSIGNMENT.greeting}
    </p>
    
    <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 24px; color: #374151;">
      ${DRIVER_UNASSIGNMENT.body(params.tripDate)}
    </p>
    
    ${createTripInfoBox(infoItems)}
    
    <p style="margin: 24px 0 0 0; font-size: 13px; line-height: 20px; color: #6b7280;">
      ${DRIVER_UNASSIGNMENT.note}
    </p>
  `;

  return baseTemplate({
    title: DRIVER_UNASSIGNMENT.title,
    body,
    variant: 'border',
  });
}

