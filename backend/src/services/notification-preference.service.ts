export type NotificationChannel = "in_app";

export interface NotificationPreferenceInput {
  organizationId: string;
  userId: string;
  type: string;
  channel: NotificationChannel;
}

export async function shouldDeliverNotification(
  _input: NotificationPreferenceInput
): Promise<boolean> {
  return true;
}
