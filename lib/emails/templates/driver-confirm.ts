/**
 * Driver Confirm Email Templates
 * 
 * Emails sent when a driver confirms a trip:
 * 1. Confirmation to driver
 * 2. Notification to trip owner
 */

import { baseTemplate, createTripInfoBox, createButton } from './base-template';
import { DRIVER_CONFIRM, TRIP_INFO } from '../content';

export interface DriverConfirmDriverParams {
  tripDate: string;
  tripLink: string;
  tripDestination?: string;
  leadPassengerName?: string;
}

export interface DriverConfirmOwnerParams {
  tripDate: string;
  tripLink: string;
  driverEmail: string;
  tripDestination?: string;
}

export function driverConfirmDriverTemplate(
  params: DriverConfirmDriverParams
): string {
  const infoItems = [
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

  const body = `
    <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 24px; color: #374151;">
      ${DRIVER_CONFIRM.driver.body}
    </p>
    
    ${createTripInfoBox(infoItems)}
    
    ${createButton(params.tripLink, DRIVER_CONFIRM.driver.buttonText, 'success')}
    
    <p style="margin: 24px 0 0 0; font-size: 14px; line-height: 20px; color: #6b7280;">
      ${DRIVER_CONFIRM.driver.note}
    </p>
  `;

  return baseTemplate({
    title: DRIVER_CONFIRM.driver.title,
    body,
    variant: 'border',
  });
}

export function driverConfirmOwnerTemplate(
  params: DriverConfirmOwnerParams
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

  infoItems.push({
    label: TRIP_INFO.driver,
    value: params.driverEmail,
  });

  infoItems.push({
    label: TRIP_INFO.status,
    value: '✓ Confirmed',
    color: '#3ea34b',
  });

  const body = `
    <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 24px; color: #374151;">
      ${DRIVER_CONFIRM.owner.body(params.driverEmail)}
    </p>
    
    ${createTripInfoBox(infoItems)}
    
    ${createButton(params.tripLink, DRIVER_CONFIRM.owner.buttonText, 'success')}
  `;

  return baseTemplate({
    title: DRIVER_CONFIRM.owner.title,
    body,
    variant: 'border',
  });
}

