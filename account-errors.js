export function friendlyError(error) {
  const messages = {
    'auth/invalid-credential': 'Email or password is incorrect. Please try again.',
    'auth/wrong-password': 'Email or password is incorrect. Please try again.',
    'auth/user-not-found': 'Email or password is incorrect. Please try again.',
    'auth/email-already-in-use': 'That email already has an account. Log in instead.',
    'auth/weak-password': 'Choose a stronger password with at least 8 characters.',
    'auth/password-does-not-meet-requirements': 'Your password does not meet the account password policy. Choose a stronger password.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/too-many-requests': 'Too many attempts. Please wait before trying again.',
    'auth/network-request-failed': 'Cannot reach the account service. Your device data is still available.',
    'auth/operation-not-allowed': 'Email/password sign-in must be enabled in Firebase Authentication.',
    'auth/unauthorized-domain': 'This domain must be allowed in Firebase Authentication settings.',
    'auth/user-disabled': 'This account is disabled. Contact the site owner.',
    'auth/web-storage-unsupported': 'This browser blocks account storage. Allow site storage to stay signed in.',
    'permission-denied': 'Cloud access was denied. Check that the owner-only Firestore rules have been published. Device data is kept.',
    'resource-exhausted': 'The free cloud quota has been reached. Changes remain on this device; retry later.',
    'unavailable': 'Cloud sync is unavailable or offline. Changes remain on this device.',
    'deadline-exceeded': 'The cloud connection timed out. Changes remain on this device.',
    'failed-precondition': 'Cloud sync is not ready. Check the Firestore database setup. Device data is kept.'
  };
  if (messages[error?.code]) return messages[error.code];
  if (error?.code) return 'The account service could not complete this request. Your device data is kept. Please retry.';
  return error?.message || 'Cloud sync failed. Your device data is kept. Please retry.';
}
