import { isMissingProfileRow } from './auth';

console.log('====================================================');
console.log('RUNNING PROFILE-READ FAILURE CLASSIFICATION VERIFICATION');
console.log('====================================================');

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string) {
  totalTests++;
  if (condition) {
    console.log(`✓ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`✗ FAIL: ${testName}`);
    process.exitCode = 1;
  }
}

// ---------------------------------------------------------------------------
// 1. The one failure that IS about the user's access
// ---------------------------------------------------------------------------
// A `.single()` read of a row that isn't there (or is hidden by RLS) comes back
// as PGRST116 — "JSON object requested, multiple (or no) rows returned".
assert(
  isMissingProfileRow({ code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' }),
  'Absent row: PGRST116 is recognised from the code alone'
);
assert(
  isMissingProfileRow({ message: 'JSON object requested, multiple (or no) rows returned' }),
  'Absent row: recognised from the wording too, for a reply that carries no code'
);
assert(
  isMissingProfileRow({ message: '0 rows returned' }),
  'Absent row: "0 rows returned" is recognised'
);

// ---------------------------------------------------------------------------
// 2. The failures that are NOT about the profile — the reported console bug
// ---------------------------------------------------------------------------
// An offline tablet, a DNS blip and a sleeping connection all reach the app as
// a fetch-level error with NO PostgREST code. The old code could not tell these
// apart from "no row", so it warned "Failed to load profile" and cleared the
// profile mid-shift.
const transportFailures = [
  { message: 'TypeError: Failed to fetch' },
  { message: 'NetworkError when attempting to fetch resource.', code: '' },
  { message: 'Load failed' },
  { message: 'getaddrinfo ENOTFOUND rygliowzxllcccpwxbgt.supabase.co' },
  { message: 'The operation was aborted due to timeout' },
  { message: 'fetch failed' },
  { message: 'NetworkError' }
];
for (const failure of transportFailures) {
  assert(
    isMissingProfileRow(failure) === false,
    `Transport failure keeps the loaded profile: "${failure.message}"`
  );
}
assert(isMissingProfileRow(null) === false, 'No error at all is never "missing row"');
assert(isMissingProfileRow(undefined) === false, 'An undefined error is never "missing row"');

// A token that expired while the tablet was suspended: the SDK refreshes and
// retries, so this must not be read as "this user has no profile".
assert(
  isMissingProfileRow({ code: 'PGRST301', message: 'JWT expired' }) === false,
  'An expired token keeps the loaded profile (the SDK refreshes on the next read)'
);
assert(
  isMissingProfileRow({ message: 'JWT expired' }) === false,
  'An expired token is not mistaken for an absent row on the wording alone'
);

// A deployment fault (no grant on profiles, or the table missing) is not an
// absent row either: clearing the profile here would lock a working depot out
// of an app whose other tables are fine.
assert(
  isMissingProfileRow({ code: '42501', message: 'permission denied for table profiles' }) === false,
  'A missing grant does not clear the profile'
);
assert(
  isMissingProfileRow({ code: '42P01', message: 'relation "profiles" does not exist' }) === false,
  'A missing profiles table does not clear the profile'
);
assert(
  isMissingProfileRow({ message: 'Internal Server Error' }) === false,
  'A 5xx keeps the loaded profile'
);

// Every "not missing" answer must be a real boolean false, never undefined —
// the caller branches on it directly.
assert(
  transportFailures.every(failure => isMissingProfileRow(failure) === false),
  'The classifier always answers with a boolean'
);

console.log('====================================================');
console.log(`TEST SUITE RESULTS: ${passedTests}/${totalTests} TESTS PASSED`);
console.log('====================================================');
