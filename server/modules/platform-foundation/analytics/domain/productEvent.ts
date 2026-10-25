export type ProductEventName =
  | 'page_view'
  | 'search_submitted'
  | 'search_result_clicked'
  | 'checkout_started'
  | 'payment_completed'
  | 'payment_failed'
  | 'ticket_purchased';

export type ProductEventInput = {
  eventName: ProductEventName;
  source: string;
  appVersion?: string;
  userId?: string;
  sessionId?: string;
  context?: Record<string, unknown>;
};
