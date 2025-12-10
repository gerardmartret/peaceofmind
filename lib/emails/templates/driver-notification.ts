/**
 * Driver Notification Email Template
 * 
 * Email sent to driver when trip is assigned or updated.
 * Handles complex change tracking for trip updates.
 */

import { baseTemplate, createStatusIndicator, createButton } from './base-template';
import { DRIVER_NOTIFICATION, EMAIL_FOOTER } from '../content';

export interface LocationChange {
  type: 'added' | 'removed' | 'modified' | 'unchanged';
  index?: number;
  oldAddress?: string;
  newAddress?: string;
  oldTime?: string;
  newTime?: string;
  oldPurpose?: string;
  newPurpose?: string;
  addressChanged?: boolean;
  timeChanged?: boolean;
  purposeChanged?: boolean;
}

export interface TripChanges {
  tripDateChanged?: boolean;
  passengerInfoChanged?: boolean;
  vehicleInfoChanged?: boolean;
  notesChanged?: boolean;
  locations?: LocationChange[];
}

export interface DriverNotificationParams {
  tripVersion: number;
  tripDate: string;
  tripLink: string;
  status: string;
  latestChanges?: TripChanges;
  tripNotes?: string;
}

/**
 * Formats location changes HTML
 */
function formatLocationChanges(changes: TripChanges, tripDate: string): string {
  if (!changes.locations || changes.locations.length === 0) {
    return '';
  }

  const locationChanges = changes.locations.filter(
    (loc) => loc.type !== 'unchanged'
  );

  if (locationChanges.length === 0) {
    return '';
  }

  const locationItems = locationChanges
    .map((loc, index) => {
      const locationName =
        loc.type === 'added'
          ? loc.newAddress
          : loc.type === 'removed'
            ? loc.oldAddress
            : loc.newAddress || loc.oldAddress;

      if (loc.type === 'added') {
        return `
          <div style="margin: 12px 0; padding: 12px; background-color: #f0fdf4; border-left: 3px solid #3ea34b; border-radius: 4px;">
            <p style="margin: 0 0 4px 0; font-size: 15px; font-weight: 700; color: #05060A;">${locationName || `Location ${loc.index || index + 1}`}</p>
            <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 600; color: #3ea34b;">✓ Added</p>
            <p style="margin: 4px 0; font-size: 13px; color: #333333;"><strong>Time:</strong> ${loc.newTime || 'N/A'}</p>
            ${loc.newPurpose ? `<p style="margin: 4px 0; font-size: 13px; color: #333333;"><strong>Purpose:</strong> ${loc.newPurpose}</p>` : ''}
          </div>
        `;
      } else if (loc.type === 'removed') {
        return `
          <div style="margin: 12px 0; padding: 12px; background-color: #fef2f2; border-left: 3px solid #9e201b; border-radius: 4px;">
            <p style="margin: 0 0 4px 0; font-size: 15px; font-weight: 700; color: #05060A;">${locationName || `Location ${loc.index || index + 1}`}</p>
            <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 600; color: #9e201b;">✗ Removed</p>
            <p style="margin: 4px 0; font-size: 13px; color: #333333;"><strong>Time:</strong> ${loc.oldTime || 'N/A'}</p>
            ${loc.oldPurpose ? `<p style="margin: 4px 0; font-size: 13px; color: #333333;"><strong>Purpose:</strong> ${loc.oldPurpose}</p>` : ''}
          </div>
        `;
      } else if (loc.type === 'modified') {
        let modifiedFields = '';

        if (loc.addressChanged) {
          modifiedFields += `
            <p style="margin: 8px 0 4px 0; font-size: 12px; font-weight: 600; color: #666666;">Address:</p>
            <p style="margin: 0 0 2px 8px; font-size: 12px; text-decoration: line-through; color: #999999;">${loc.oldAddress || 'N/A'}</p>
            <p style="margin: 0 0 2px 8px; font-size: 13px; color: #db7304;">→</p>
            <p style="margin: 0 0 4px 8px; font-size: 13px; font-weight: 600; color: #333333;">${loc.newAddress || 'N/A'}</p>
          `;
        }

        if (loc.timeChanged) {
          modifiedFields += `
            <p style="margin: 8px 0 4px 0; font-size: 12px; font-weight: 600; color: #666666;">Time:</p>
            <p style="margin: 0 0 0 8px; font-size: 13px; color: #333333;">
              <span style="text-decoration: line-through; color: #999999;">${loc.oldTime || 'N/A'}</span>
              <span style="color: #db7304;"> → </span>
              <span style="font-weight: 600;">${loc.newTime || 'N/A'}</span>
            </p>
          `;
        }

        if (loc.purposeChanged) {
          modifiedFields += `
            <p style="margin: 8px 0 4px 0; font-size: 12px; font-weight: 600; color: #666666;">Purpose:</p>
            <p style="margin: 0 0 2px 8px; font-size: 12px; text-decoration: line-through; color: #999999;">${loc.oldPurpose || 'N/A'}</p>
            <p style="margin: 0 0 2px 8px; font-size: 13px; color: #db7304;">→</p>
            <p style="margin: 0 0 4px 8px; font-size: 13px; font-weight: 600; color: #333333;">${loc.newPurpose || 'N/A'}</p>
          `;
        }

        return `
          <div style="margin: 12px 0; padding: 12px; background-color: #fffbeb; border-left: 3px solid #db7304; border-radius: 4px;">
            <p style="margin: 0 0 4px 0; font-size: 15px; font-weight: 700; color: #05060A;">${locationName || `Location ${loc.index || index + 1}`}</p>
            <p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 600; color: #db7304;">⟳ Modified</p>
            ${modifiedFields}
          </div>
        `;
      }
      return '';
    })
    .filter(Boolean)
    .join('');

  return `
    <div style="margin-bottom: 16px;">
      <p style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #05060A;">Location Changes:</p>
      ${locationItems}
    </div>
  `;
}

/**
 * Formats latest changes HTML
 */
function formatLatestChanges(
  changes: TripChanges | undefined,
  tripVersion: number,
  tripDate: string,
  tripNotes?: string
): string {
  if (tripVersion === 1 || !changes) {
    return '';
  }

  let changesHtml = '';

  // Trip detail changes
  const detailChanges = [];
  if (changes.tripDateChanged) {
    detailChanges.push(
      `<li style="margin: 4px 0; color: #333333;">Trip date updated to: <strong>${tripDate}</strong></li>`
    );
  }
  if (changes.passengerInfoChanged) {
    detailChanges.push(
      `<li style="margin: 4px 0; color: #333333;">Passenger information updated</li>`
    );
  }
  if (changes.vehicleInfoChanged) {
    detailChanges.push(
      `<li style="margin: 4px 0; color: #333333;">Vehicle information updated</li>`
    );
  }
  if (changes.notesChanged) {
    detailChanges.push(
      `<li style="margin: 4px 0; color: #333333;">Trip notes updated</li>`
    );
  }

  if (detailChanges.length > 0) {
    changesHtml += `
      <div style="margin-bottom: 16px;">
        <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #05060A;">Trip Details Updated:</p>
        <ul style="margin: 0; padding-left: 20px; list-style-type: disc;">
          ${detailChanges.join('')}
        </ul>
      </div>
    `;
  }

  // Location changes
  if (changes.locations) {
    const locationChangesHtml = formatLocationChanges(changes, tripDate);
    if (locationChangesHtml) {
      changesHtml += locationChangesHtml;
    }
  }

  // Add merged notes preview if available
  if (tripNotes && tripVersion > 1) {
    changesHtml += `
      <div style="margin-bottom: 16px;">
        <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #05060A;">Current Trip Notes:</p>
        <div style="background-color: #eff6ff; padding: 12px; border-radius: 4px; border-left: 3px solid #3b82f6;">
          <pre style="margin: 0; font-family: inherit; font-size: 13px; color: #333333; white-space: pre-wrap; word-wrap: break-word;">${tripNotes}</pre>
        </div>
      </div>
    `;
  }

  if (changesHtml) {
    return `
      <div style="background-color: #ffffff; padding: 20px; border-radius: 6px; margin: 20px 0; border: 1px solid #d9d9d9;">
        <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #05060A;">${DRIVER_NOTIFICATION.changesTitle}</h3>
        ${changesHtml}
      </div>
    `;
  }

  return '';
}

export function driverNotificationTemplate(
  params: DriverNotificationParams
): { subject: string; html: string } {
  const { tripVersion, tripDate, tripLink, status, latestChanges, tripNotes } =
    params;

  const isNew = tripVersion === 1;
  const statusDisplay =
    status === 'confirmed' ? 'Confirmed' : 'Pending Confirmation';
  const statusColor = status === 'confirmed' ? '#3ea34b' : '#999999';

  const body = `
    <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.5; color: #333333;">
      ${DRIVER_NOTIFICATION.greeting}
    </p>
    
    <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.5; color: #333333;">
      ${isNew ? DRIVER_NOTIFICATION.body.new(tripDate) : DRIVER_NOTIFICATION.body.update(tripDate)}
    </p>
    
    ${createStatusIndicator(DRIVER_NOTIFICATION.statusLabel, statusDisplay, statusColor)}
    
    ${formatLatestChanges(latestChanges, tripVersion, tripDate, tripNotes)}
    
    ${createButton(tripLink, DRIVER_NOTIFICATION.buttonText, 'primary')}
    
    <p style="margin: 24px 0 0 0; padding-top: 20px; border-top: 1px solid #d9d9d9; font-size: 13px; line-height: 1.5; color: #666666;">
      ${DRIVER_NOTIFICATION.note}
    </p>
  `;

  return {
    subject: isNew
      ? DRIVER_NOTIFICATION.subject.new(tripDate)
      : DRIVER_NOTIFICATION.subject.update(tripDate),
    html: baseTemplate({
      title: isNew
        ? DRIVER_NOTIFICATION.title.new
        : DRIVER_NOTIFICATION.title.update,
      body,
      footer: EMAIL_FOOTER,
    }),
  };
}

