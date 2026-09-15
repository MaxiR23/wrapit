-- Unread notification.count and listNotificationsForUser (recipientId, read, createdAt desc).
CREATE INDEX "Notification_unread_count_and_list_idx" ON "Notification"("recipientId", "read", "createdAt");
