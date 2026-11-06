import { Rng } from '../core/rng';

/** Original syllable-based name generator: no real players. */
const FIRST_A = ['Ar', 'Bel', 'Cas', 'Dar', 'El', 'Fen', 'Gal', 'Hal', 'Il', 'Jor', 'Kel', 'Lio', 'Mar', 'Nor', 'Os', 'Per', 'Quin', 'Ras', 'Sol', 'Tav', 'Ul', 'Vas', 'Wen', 'Xan', 'Yor', 'Zan', 'Ced', 'Dov', 'Emi', 'Fil', 'Gus', 'Hen', 'Ivo', 'Jan', 'Kai', 'Lor', 'Mat', 'Nik', 'Oto', 'Pau', 'Rem', 'Sam', 'Teo', 'Val', 'Wil', 'Zek'];
const FIRST_B = ['o', 'an', 'en', 'ic', 'is', 'ar', 'el', 'ius', 'io', 'as', 'ek', 'on', 'ian', 'en', 'ar', 'iel', 'ko', 'mo', 'ro', 'ay'];
const LAST_A = ['Dess', 'Var', 'Hol', 'Brig', 'Cal', 'Dun', 'Est', 'Fair', 'Gran', 'Hask', 'Ilv', 'Jask', 'Kov', 'Lind', 'Mor', 'Nov', 'Ost', 'Pell', 'Quar', 'Rov', 'Sund', 'Tor', 'Ulr', 'Vel', 'Wex', 'Yar', 'Zel', 'Ash', 'Bram', 'Corr', 'Dal', 'Elm', 'Frey', 'Gor', 'Hart', 'Ives', 'Kest', 'Lam', 'Marr', 'Ness', 'Orl', 'Pask', 'Riv', 'Stav', 'Tull', 'Vant', 'Wald'];
const LAST_B = ['in', 'ard', 'ov', 'ström', 'berg', 'ani', 'ez', 'ley', 'ton', 'ski', 'elli', 'ens', 'man', 'ac', 'ers', 'ford', 'ić', 'ola', 'ard', 'ek', 'us', 'ino', 'ade', 'ham', 'enko', 'és', 'ow', 'ier'];

export const CITIES = [
  'Port Aurel', 'Vellmar', 'San Coral', 'Northgate', 'Kestrova', 'Lumen Bay', 'Ardenfell', 'Rio Plata Nova', 'Oskarvik', 'Mirabel',
  'Tessaly', 'Brightwater', 'Doranza', 'Halcyon', 'Ostmark', 'Calder Reach', 'Pinecrest', 'Sol Marena', 'Verdigris', 'Elmstead',
  'Corvana', 'Baylor Sands', 'Ironvale', 'Saint Elric', 'Montevar', 'Riverholm', 'Zafira', 'Glenmoor', 'Novalis', 'Aster Point',
];

export function genName(r: Rng): { first: string; last: string } {
  const first = r.pick(FIRST_A) + r.pick(FIRST_B);
  const last = r.pick(LAST_A) + r.pick(LAST_B);
  return { first, last };
}
