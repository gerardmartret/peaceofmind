/**
 * Base Email Template
 * 
 * Reusable HTML wrapper for all email notifications.
 * Handles both border and non-border variants.
 */

export interface BaseTemplateOptions {
  title: string;
  body: string;
  variant?: 'border' | 'default';
  footer?: string;
}

/**
 * Generates the base HTML structure for emails
 */
export function baseTemplate(options: BaseTemplateOptions): string {
  const { title, body, variant = 'default', footer } = options;

  const bodyStyle =
    variant === 'border'
      ? 'padding: 32px 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;'
      : 'background-color: #f5f5f5; padding: 32px 24px; border-radius: 0 0 8px 8px;';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background-color: #ffffff;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff;">
              <!-- Header -->
              <tr>
                <td style="background-color: #05060A; padding: 24px; border-radius: 8px 8px 0 0;">
                  <h1 style="margin: 0; font-size: 20px; font-weight: 600; color: #ffffff; letter-spacing: -0.5px;">${title}</h1>
                </td>
              </tr>
              
              <!-- Body -->
              <tr>
                <td style="${bodyStyle}">
                  ${body}
                </td>
              </tr>
              ${footer ? `<!-- Footer --><tr><td align="center" style="padding: 20px 0;"><p style="margin: 0; font-size: 12px; color: #999999;">${footer}</p></td></tr>` : ''}
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

/**
 * Helper to create a button/link
 */
export function createButton(
  href: string,
  text: string,
  variant: 'primary' | 'success' = 'primary'
): string {
  const bgColor = variant === 'success' ? '#3ea34b' : '#05060A';
  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0;">
      <tr>
        <td align="center">
          <a href="${href}" style="display: inline-block; background-color: ${bgColor}; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-size: 15px; font-weight: 600;">${text}</a>
        </td>
      </tr>
    </table>
  `;
}

/**
 * Helper to create a trip info box
 */
export function createTripInfoBox(
  items: Array<{ label: string; value: string; color?: string }>
): string {
  const rows = items
    .map((item, index) => {
      const borderTop = index > 0 ? 'border-top: 1px solid #e5e7eb;' : '';
      const valueColor = item.color || '#111827';
      const valueWeight = item.color ? 'font-weight: 600;' : 'font-weight: 500;';
      return `
        <tr>
          <td style="padding: 8px 0; font-size: 14px; color: #6b7280; ${borderTop}">${item.label}</td>
          <td style="padding: 8px 0; font-size: 14px; color: ${valueColor}; ${valueWeight} text-align: right; ${borderTop}">${item.value}</td>
        </tr>
      `;
    })
    .join('');

  return `
    <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin: 24px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        ${rows}
      </table>
    </div>
  `;
}

/**
 * Helper to create a status box
 */
export function createStatusBox(
  label: string,
  status: string,
  color: string
): string {
  return `
    <div style="background-color: #ffffff; padding: 20px; border-radius: 6px; margin: 24px 0; border-left: 4px solid ${color};">
      <p style="margin: 0 0 8px 0; font-size: 13px; font-weight: 600; color: #666666; text-transform: uppercase; letter-spacing: 0.5px;">
        ${label}
      </p>
      <p style="margin: 0; font-size: 24px; font-weight: 700; color: ${color};">
        ${status}
      </p>
    </div>
  `;
}

/**
 * Helper to create a simple status indicator
 */
export function createStatusIndicator(
  label: string,
  status: string,
  color: string
): string {
  return `
    <div style="background-color: #ffffff; padding: 16px; border-radius: 6px; margin: 16px 0; border-left: 4px solid ${color};">
      <p style="margin: 0; font-size: 14px; color: #666666;">
        <strong style="color: #05060A;">${label}</strong> 
        <span style="color: ${color}; font-weight: 600; margin-left: 8px;">${status}</span>
      </p>
    </div>
  `;
}

