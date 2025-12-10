/**
 * Email Content
 * 
 * Centralized text content for all email notifications.
 * All user-facing strings are defined here for easy maintenance and updates.
 */

export const EMAIL_FROM = 'Chauffs <info@trips.chauffs.com>';
export const EMAIL_FOOTER = 'This is an automated notification from Chauffs';

// Driver Assignment
export const DRIVER_ASSIGNMENT = {
  subject: (tripDate: string) => `You've been assigned to a trip - ${tripDate}`,
  title: "You've been assigned to a trip",
  greeting: 'Hi,',
  body: "You've been assigned to a trip and your confirmation is needed.",
  linkText: 'View and confirm trip',
  linkNote: 'This link is valid for 3 days and can only be used once. If you have any questions about this trip, please reply to this email.',
};

// Driver Unassignment
export const DRIVER_UNASSIGNMENT = {
  subject: (tripDate: string) => `Trip assignment cancelled - ${tripDate}`,
  title: 'Trip assignment cancelled',
  greeting: 'Hi,',
  body: (tripDate: string) => `You have been unassigned from a trip scheduled on <strong style="color: #05060A;">${tripDate}</strong>.`,
  note: 'The trip owner has assigned a different driver to this trip. If you have any questions, please reply to this email.',
};

// Quote Request
export const QUOTE_REQUEST = {
  subject: (tripDate: string) => `Quote Request - Trip on ${tripDate}`,
  title: 'Quote Request',
  greeting: 'Hello,',
  body: (tripDate: string) => `You have been invited to submit a quote for a trip scheduled on <strong style="color: #05060A;">${tripDate}</strong>.`,
  instructions: {
    title: 'Instructions:',
    steps: [
      'Click the button below to view the trip details',
      'Review the complete trip information',
      'Submit your quote at the bottom of the page',
    ],
  },
  buttonText: 'View Trip & Submit Quote',
  note: 'Click the button above to access the trip details and submit your pricing quote. The trip owner will review all quotes received.',
};

// Booking Request (to Drivania)
export const BOOKING_REQUEST = {
  subject: 'New Booking Request',
  title: 'New Booking Request',
  body: 'A new booking request has been submitted.',
  detailsTitle: 'Booking Details:',
  note: 'Please process this booking request accordingly.',
};

// Driver Notification (Trip Assignment/Update)
export const DRIVER_NOTIFICATION = {
  subject: {
    new: (tripDate: string) => `New Trip Assignment - ${tripDate}`,
    update: (tripDate: string) => `Trip Update - ${tripDate}`,
  },
  title: {
    new: 'New Trip Assignment',
    update: 'Trip Updated',
  },
  greeting: 'Hello,',
  body: {
    new: (tripDate: string) => `Your trip scheduled for <strong style="color: #05060A;">${tripDate}</strong> has been created.`,
    update: (tripDate: string) => `Your trip scheduled for <strong style="color: #05060A;">${tripDate}</strong> has been updated.`,
  },
  buttonText: 'View Trip Details',
  note: 'Click the button above to view the complete trip information and itinerary.',
  changesTitle: 'What Changed:',
  statusLabel: 'Status:',
};

// Status Change Notifications
export const STATUS_CHANGE = {
  cancelled: {
    subject: (tripDate: string) => `Trip Cancelled - ${tripDate}`,
    title: 'Trip Cancelled',
    greeting: 'Hello,',
    body: (tripDate: string) => `The trip scheduled on <strong style="color: #05060A;">${tripDate}</strong> has been cancelled.`,
    note: 'No further action is required.',
    statusDisplay: 'Cancelled',
    statusColor: '#999999',
  },
  acceptanceRequest: {
    subject: (tripDate: string) => `Trip Assignment - Please Accept - ${tripDate}`,
    title: 'Service Confirmed - Please Accept Trip',
    greeting: 'Hello,',
    body: (tripDate: string) => `You have been assigned to a trip scheduled on <strong style="color: #05060A;">${tripDate}</strong>. The service has been confirmed by the client, and we need your acceptance to proceed.`,
    actionRequired: {
      label: 'Action Required',
      text: 'Please accept or reject this trip',
    },
    statusDisplay: 'Awaiting Your Response',
    statusColor: '#e77500',
  },
  confirmed: {
    subject: (tripDate: string) => `Confirmed - ${tripDate}`,
    title: 'Service Confirmed',
    greeting: 'Hello,',
    body: (tripDate: string) => `Great news! Your quote has been accepted and the service for <strong style="color: #05060A;">${tripDate}</strong> is now confirmed.`,
    note: 'Please review the trip details and contact the client if you have any questions.',
    statusDisplay: 'Confirmed',
    statusColor: '#3ea34b',
  },
  generic: {
    subject: (tripDate: string) => `Trip Status Changed - ${tripDate}`,
    title: 'Trip Status Changed',
    greeting: 'Hello,',
    body: (tripDate: string) => `The status for your trip scheduled on <strong style="color: #05060A;">${tripDate}</strong> has been changed.`,
  },
  statusLabel: 'New Status',
  buttonText: 'View Trip Details',
  note: 'Click the button above to view the complete trip information and any updates.',
};

// Driver Confirm Trip
export const DRIVER_CONFIRM = {
  driver: {
    subject: (tripDate: string) => `Confirmed - ${tripDate}`,
    title: 'Confirmed',
    body: 'Thank you for confirming your availability for this trip.',
    buttonText: 'View trip details',
    note: 'If you have any questions about this trip, please reply to this email.',
  },
  owner: {
    subject: (tripDate: string) => `Driver confirmed trip - ${tripDate}`,
    title: 'Driver confirmed trip',
    body: (driverEmail: string) => `Good news! ${driverEmail} has confirmed their availability for your trip.`,
    buttonText: 'View trip details',
  },
};

// Driver Reject Trip
export const DRIVER_REJECT = {
  subject: (tripDate: string) => `Driver declined trip - ${tripDate}`,
  title: 'Driver declined trip',
  body: (driverEmail: string) => `The driver (${driverEmail}) has declined your trip assignment.`,
  note: 'You can now assign a different driver to this trip.',
  buttonText: 'View trip and assign driver',
};

// Trip Info Labels
export const TRIP_INFO = {
  date: 'Trip date:',
  destination: 'Destination:',
  passenger: 'Passenger:',
  driver: 'Driver:',
  status: 'Status:',
};

// Status Display Values
export const STATUS_DISPLAY = {
  pending: 'Pending Confirmation',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
  unassigned: 'Unassigned',
  awaitingResponse: '⏱️ Pending your confirmation',
};

// Status Colors
export const STATUS_COLORS = {
  confirmed: '#3ea34b',
  pending: '#999999',
  cancelled: '#999999',
  rejected: '#dc2626',
  unassigned: '#9e201b',
  awaitingResponse: '#e77500',
};

// Welcome Email
export const WELCOME = {
  subject: 'Welcome to Chauffs!',
  title: 'Welcome to Chauffs',
  greeting: 'Thank you for signing up!',
  body: 'Plan trips with AI, collect driver quotes, and assign your favourite driver. Update trips anytime—drivers always get the latest info.',
  ctaText: 'Create your first trip',
  note: 'We\'re here to help you plan your next journey.',
};

// Quote Submitted Notification
export const QUOTE_SUBMITTED = {
  subject: (destination: string) => `New quote submitted for trip to ${destination}`,
  title: 'New Quote Submitted',
  body: (destination: string) => `A driver has submitted a quote for your trip to <strong style="color: #05060A;">${destination}</strong>.`,
  ctaText: 'See quotes',
  note: 'Review all quotes and select your preferred driver.',
};

// Driver Response Notification (Confirm/Reject)
export const DRIVER_RESPONSE = {
  confirmed: {
    subject: (destination: string) => `Driver confirmed trip to ${destination}`,
    title: (destination: string) => `Driver confirmed trip to ${destination}`,
    body: (destination: string) => `A driver has confirmed your trip to <strong style="color: #05060A;">${destination}</strong>.`,
    statusLabel: 'Status:',
    statusValue: 'Confirmed',
    statusColor: '#3ea34b',
  },
  rejected: {
    subject: (destination: string) => `Driver rejected trip to ${destination}`,
    title: (destination: string) => `Driver rejected trip to ${destination}`,
    body: (destination: string) => `A driver has rejected your trip to <strong style="color: #05060A;">${destination}</strong>.`,
    statusLabel: 'Status:',
    statusValue: 'Rejected',
    statusColor: '#dc2626',
  },
  ctaText: 'Go to trip',
  note: 'You can assign a different driver if needed.',
};

// Booking Confirmation (Drivania)
export const BOOKING_CONFIRMATION = {
  subject: (destination: string) => `Thank you for booking your trip to ${destination} with Chauffs Trusted Drivers`,
  title: (destination: string) => `Thank you for booking your trip to ${destination}`,
  greeting: 'Thank you for booking with Chauffs Trusted Drivers!',
  body: 'Your trip has been successfully booked. Our trusted partner will reach out to you shortly.',
  ctaText: 'Book another trip',
  note: 'We look forward to serving you again.',
};

// Guest Trip Created
export const GUEST_TRIP_CREATED = {
  subject: 'Unlock full functionality of Chauffs',
  title: 'Unlock full functionality of Chauffs',
  greeting: 'Hello,',
  body: (destination: string) => `You created a trip to <strong style="color: #05060A;">${destination}</strong>, but here's more what you can do:`,
  benefits: [
    'Unlimited trips',
    'Instant fixed pricing',
    'Pick your driver',
    'Edit trips instantly',
    'Billed in seconds',
    'Secure payments',
  ],
  freeNote: 'And it\'s completely <strong style="color: #3ea34b;">free</strong>!',
  ctaText: 'Unlock all the features',
  note: 'Create your account to access all features and manage your trips with ease.',
};

