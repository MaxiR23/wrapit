-- listNotificationsForUser: WHERE recipientId ORDER BY createdAt DESC.
-- Notification_unread_count_and_list_idx cannot serve that order because
-- unconstrained `read` sits between recipientId and createdAt.
CREATE INDEX "Notification_list_by_recipient_created_idx" ON "Notification"("recipientId", "createdAt");
