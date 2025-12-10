/**
 * Quote Submitted Email Template
 * 
 * Email sent to trip owner when a driver submits a quote.
 */

import { baseTemplate, createButton, createTripInfoBox } from './base-template';
import { QUOTE_SUBMITTED, EMAIL_FOOTER } from '../content';

export interface QuoteSubmittedParams {
  destination: string;
  driverEmail: string;
  price: number;
  currency: string;
  tripLink: string;
}

export function quoteSubmittedTemplate(params: QuoteSubmittedParams): string {
  const { destination, driverEmail, price, currency, tripLink } = params;

  // Format price with currency symbol
  const formattedPrice = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);

  const infoItems = [
    {
      label: 'Driver:',
      value: driverEmail,
    },
    {
      label: 'Quote:',
      value: formattedPrice,
    },
    {
      label: 'Currency:',
      value: currency,
    },
  ];

  const body = `
    <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.5; color: #333333;">
      ${QUOTE_SUBMITTED.body(destination)}
    </p>
    
    ${createTripInfoBox(infoItems)}
    
    ${createButton(tripLink, QUOTE_SUBMITTED.ctaText, 'primary')}
    
    <p style="margin: 24px 0 0 0; padding-top: 20px; border-top: 1px solid #d9d9d9; font-size: 13px; line-height: 1.5; color: #666666;">
      ${QUOTE_SUBMITTED.note}
    </p>
  `;

  return baseTemplate({
    title: QUOTE_SUBMITTED.title,
    body,
    footer: EMAIL_FOOTER,
  });
}
