-- Clears test data before launch. Keeps: admin user (id 1), signs 0001-0010, untouched stock 0011-0200.
-- 1. Stock signs that test orders used go back to blank, unassigned
UPDATE signs SET order_id=NULL, owner_id=NULL, label=NULL, destination=NULL, archived_at=NULL
  WHERE reserved=0 AND id GLOB '[0-9][0-9][0-9][0-9]' AND id < '9000';
-- 2. Throwaway test signs (9001-9003 and the Q custom ones) are deleted
DELETE FROM signs WHERE reserved=0 AND (id LIKE 'Q%' OR id >= '9000');
-- 3. Reserved signs 0001-0010 belong to the admin again, no leftover order link
UPDATE signs SET order_id=NULL, owner_id=1 WHERE reserved=1;
-- 4. Test orders, scans, other users, sign-in leftovers, test messages
DELETE FROM orders;
DELETE FROM scans;
DELETE FROM login_tokens;
DELETE FROM sessions WHERE user_id <> 1;
DELETE FROM users WHERE id <> 1;
DELETE FROM contact_messages;
