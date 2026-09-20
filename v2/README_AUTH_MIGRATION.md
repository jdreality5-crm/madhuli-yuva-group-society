# Authentication migration note

Master Admin Firebase linking must be completed before changing the database email. The login route supports Firebase authentication for linked Master Admin accounts; the database `firebaseUid` must be populated only after the Firebase account is created and verified.
