import { createRequire } from 'node:module';
import { dirname } from 'node:path';

const require = createRequire(import.meta.url);

function packageVersion(packageJsonPath) {
  return require(packageJsonPath).version;
}

const firebasePackagePath = require.resolve('firebase/package.json');
const firestorePackagePath = require.resolve('@firebase/firestore/package.json');
const firebaseRequire = createRequire(`${dirname(firebasePackagePath)}/runtime-check.cjs`);
const firestoreRequire = createRequire(`${dirname(firestorePackagePath)}/runtime-check.cjs`);

const appFromFirebase = firebaseRequire.resolve('@firebase/app/package.json');
const appFromFirestore = firestoreRequire.resolve('@firebase/app/package.json');
const firebaseAppVersion = packageVersion(appFromFirebase);
const firestoreAppVersion = packageVersion(appFromFirestore);

if (appFromFirebase !== appFromFirestore || firebaseAppVersion !== firestoreAppVersion) {
  console.error(
    [
      'Firebase SDK runtime mismatch detected.',
      `firebase/app resolves @firebase/app ${firebaseAppVersion} from ${appFromFirebase}`,
      `firebase/firestore resolves @firebase/app ${firestoreAppVersion} from ${appFromFirestore}`,
      'Keep @firebase/app pinned to the version required by the installed firebase package.',
    ].join('\n'),
  );
  process.exit(1);
}

console.log(`Firebase SDK runtime aligned on @firebase/app ${firebaseAppVersion}.`);
