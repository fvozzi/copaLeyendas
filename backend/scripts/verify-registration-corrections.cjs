// Run after npm run build. Creates and drops its own disposable LOCAL database.
require('dotenv').config({ path: require('node:path').join(__dirname, '../.env') });
require('reflect-metadata');
const assert = require('node:assert/strict');
const { Client } = require('pg');
const { DataSource } = require('typeorm');
const { buildStandaloneDataSourceOptions } = require('../dist/database/typeorm.config');
const { RegistrationsService } = require('../dist/registrations/registrations.service');
const { CashService } = require('../dist/cash/cash.service');
const { AddRegistrationPayments1790035200000 } = require('../dist/database/migrations/1790035200000-AddRegistrationPayments');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { ensurePaymentProofDir } = require('../dist/registrations/payment-proof-storage');
const ownFiles = [];
function proof(label) {
  const filename = `correction-test-${randomUUID()}.pdf`;
  const filePath = path.join(ensurePaymentProofDir(), filename);
  fs.writeFileSync(filePath, label); ownFiles.push(filePath);
  return { filename, originalname: `${label}.pdf`, mimetype: 'application/pdf', size: label.length, path: filePath };
}
const { PlayersService } = require('../dist/players/players.service');
const entity = (folder, file, name) => require(`../dist/${folder}/${file}`)[name];
const Registration = entity('registrations', 'pair-registration.entity', 'PairRegistration');
const Payment = entity('registrations', 'registration-payment.entity', 'RegistrationPayment');
const Settings = entity('cash', 'cash-settings.entity', 'CashSettings');
const Expense = entity('cash', 'cash-expense.entity', 'CashExpense');
const Grant = entity('registrations', 'registration-access-grant.entity', 'RegistrationAccessGrant');
const Player = entity('players', 'player.entity', 'Player');
const Locality = entity('localities', 'locality.entity', 'Locality');
const Tournament = entity('tournaments', 'tournament.entity', 'Tournament');
const Category = entity('categories', 'category.entity', 'Category');
const options = buildStandaloneDataSourceOptions();
assert(['localhost', '127.0.0.1', '::1'].includes(options.host), 'This check requires a local database');
const testDatabase = `copa_corrections_test_${Date.now()}`;
const admin = new Client({ host: options.host, port: options.port, user: options.username, password: options.password, database: options.database });
let ds;
let created = false;
async function main() {
  await admin.connect();
  await admin.query(`CREATE DATABASE "${testDatabase}"`); created = true;
  ds = await new DataSource({ ...options, database: testDatabase, synchronize: false, logging: false }).initialize();
  await ds.runMigrations({ transaction: 'each' });
  const repo = (type) => ds.getRepository(type);
  const category = await repo(Category).save(repo(Category).create({ name: 'Corrections test' }));
  const grant = await repo(Grant).save(repo(Grant).create({ token: 'COPA-CORRECT1', categoryId: category.id, localityName: 'Junin', provinceName: 'BA', clubName: 'Junin', feeWaived: false }));
  const drive = { enabled: () => false };
  const players = new PlayersService(repo(Player), repo(Locality), repo(Registration), drive);
  const service = new RegistrationsService(repo(Registration), repo(Grant), repo(Locality), repo(Tournament), repo(Category), players, drive, {});
  const dto = { accessToken: grant.token, heardAboutSource: 'CLUB', tournamentAvailabilityConfirmed: true, representingText: 'Junin', contactEmail: 'team@example.test',
    playerOneName: 'Player One', playerOneDni: '11111111', playerOneBirthDate: '1980-01-01', playerOnePhone: '1111111111', playerOneShirtSize: 'M', playerOneHasCommercialAgreement: true, playerOneCommercialAgreementDetails: 'Dabber',
    playerTwoName: 'Player Two', playerTwoDni: '22222222', playerTwoBirthDate: '1981-01-01', playerTwoPhone: '2222222222', playerTwoShirtSize: 'L', playerTwoHasCommercialAgreement: false,
  };
  const originalProof = proof('proof');
  const initial = await service.createPublic(dto, { paymentProof: originalProof });
  const cash = new CashService(repo(Settings), repo(Expense), repo(Registration));
  assert.equal((await cash.summary()).totalIncome, 30000);
  // Round-trip the migration over a legacy two-player proof; preserve the same income.
  const runner = ds.createQueryRunner(); await runner.connect();
  const migration = new AddRegistrationPayments1790035200000();
  await migration.down(runner); await migration.up(runner); await runner.release();
  assert.equal((await cash.summary()).totalIncome, 30000);
  const originalPlayer = await repo(Player).findOneByOrFail({ dni: dto.playerOneDni });
  assert.equal(await repo(Player).count(), 2);
  assert.equal((await service.getPublicAccessGrant(grant.token)).registration, null);
  await assert.rejects(service.createPublic(dto), /Token no disponible/);
  await repo(Registration).update(initial.id, { status: 'CONFIRMED', adminNotes: 'Keep approval', feeWaived: false, feePerPlayer: 15000, playerOnePhotoStoredName: 'existing-photo.webp', playerOnePhotoOriginalName: 'photo.webp' });
  await repo(Grant).update(grant.id, { feeWaived: false });
  await service.updateAccessGrantStatus(grant.id, { status: 'ACTIVE' });
  const draft = await service.getPublicAccessGrant(grant.token);
  assert.equal(draft.registration.fields.playerOneName, dto.playerOneName);
  assert.equal(draft.registration.photos.playerOne, 'photo.webp');
  assert.equal(draft.registration.paymentProofName, 'proof.pdf');
  assert(!JSON.stringify(draft).includes('Keep approval'));
  assert(!JSON.stringify(draft).includes('existing-photo.webp'));
  const correction = { ...dto, playerOneName: 'Corrected Name', playerOneDni: '11111112', playerOnePhone: '9999999999', playerOneInstagram: '', playerOneShirtSize: 'XL', playerOneHasCommercialAgreement: false, playerOneCommercialAgreementDetails: '', playerThreeName: 'New Substitute', playerThreeDni: '33333333', playerThreeBirthDate: '1982-01-01', playerThreePhone: '3333333333', playerThreeShirtSize: 'S', playerThreeHasCommercialAgreement: true, playerThreeCommercialAgreementDetails: 'Guastavino' };
  await assert.rejects(service.createPublic(correction), /nuevo comprobante/);
  assert.equal((await repo(Registration).findOneByOrFail({ id: initial.id })).playerThreeName, null);
  assert.equal((await cash.summary()).totalIncome, 30000);
  const results = await Promise.allSettled([service.createPublic(correction, { paymentProof: proof('extra-a') }), service.createPublic(correction, { paymentProof: proof('extra-b') })]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  const result = results.find((result) => result.status === 'fulfilled').value;
  assert.equal(result.id, initial.id);
  assert.equal(await repo(Registration).count(), 1);
  assert.equal(await repo(Player).count(), 3);
  const saved = await repo(Registration).findOneByOrFail({ id: initial.id });
  assert.equal(saved.status, 'CONFIRMED');
  assert.equal(saved.adminNotes, 'Keep approval');
  assert.equal(saved.feePerPlayer, 15000);
  assert.equal(saved.paymentProofStoredName, originalProof.filename);
  assert.equal(saved.playerOnePhotoStoredName, 'existing-photo.webp');
  assert.equal(saved.playerThreeName, 'New Substitute');
  const receipts = (await service.getById(initial.id)).payments.sort((a,b) => a.id-b.id);
  assert.equal(receipts.length, 2);
  assert.deepEqual(receipts.map(r=>[r.kind,r.players,r.amount]), [['INITIAL',2,30000],['ADDITIONAL',1,15000]]);
  assert.equal((await cash.summary()).totalIncome, 45000);
  for (const receipt of receipts) {
    const file = await service.getPaymentProof(initial.id, receipt.id);
    const chunks = []; for await (const chunk of file.stream.getStream()) chunks.push(chunk);
    assert.equal(Buffer.concat(chunks).toString(), receipt.originalName.replace('.pdf',''));
  }
  await assert.rejects(service.getPaymentProof(initial.id, 999999), /Comprobante no encontrado/);
  const corrected = await repo(Player).findOneByOrFail({ dni: correction.playerOneDni });
  assert.equal(corrected.id, originalPlayer.id);
  assert.equal(corrected.fullName, 'Corrected Name');
  assert.equal(corrected.shirtSize, 'XL');
  assert.equal(corrected.instagram, null);
  assert.equal((await players.list({})).find((player) => player.id === corrected.id).hasCommercialAgreement, false);
  assert.equal((await repo(Grant).findOneByOrFail({ id: grant.id })).status, 'USED');
  // Revocation closes the draft again; re-enabling it keeps the new data.
  await service.updateAccessGrantStatus(grant.id, { status: 'ACTIVE' });
  await service.updateAccessGrantStatus(grant.id, { status: 'REVOKED' });
  assert.equal((await service.getPublicAccessGrant(grant.token)).registration, null);
  await assert.rejects(service.createPublic(correction), /Token no disponible/);
  await service.updateAccessGrantStatus(grant.id, { status: 'ACTIVE' });
  assert.equal((await service.getPublicAccessGrant(grant.token)).registration.fields.playerThreeName, 'New Substitute');
  // A failed player update must roll back the registration AND leave its token enabled.
  const synchronize = players.syncRegistrationPlayers.bind(players);
  players.syncRegistrationPlayers = async () => { throw new Error('Simulated failure'); };
  await assert.rejects(service.createPublic({ ...correction, playerOneName: 'Must roll back' }, { paymentProof: proof('rollback') }), /Simulated failure/);
  assert.equal(await repo(Payment).count(), 2);
  assert.equal((await repo(Registration).findOneByOrFail({ id: initial.id })).playerOneName, 'Corrected Name');
  assert.equal((await repo(Grant).findOneByOrFail({ id: grant.id })).status, 'ACTIVE');
  players.syncRegistrationPlayers = synchronize;
  await service.createPublic(correction);
  assert.equal(await repo(Registration).count(), 1);
  assert.equal(await repo(Player).count(), 3);
  assert.equal((await cash.summary()).totalIncome, 45000);
  assert.equal(await repo(Payment).count(), 2);
  // Director confirmation also closes a reopened correction, preserving the actual use time.
  const consumedAt = (await repo(Grant).findOneByOrFail({ id: grant.id })).consumedAt;
  await service.updateAccessGrantStatus(grant.id, { status: 'ACTIVE' });
  await service.updateStatus(initial.id, { status: 'UNDER_REVIEW', adminNotes: 'Review correction' });
  assert.equal((await repo(Grant).findOneByOrFail({ id: grant.id })).status, 'ACTIVE');
  await service.updateStatus(initial.id, { status: 'CONFIRMED' });
  const closed = await repo(Grant).findOneByOrFail({ id: grant.id });
  assert.equal(closed.status, 'USED');
  assert.equal(closed.consumedAt.toISOString(), consumedAt.toISOString());
  assert.equal((await service.getById(initial.id)).adminNotes, 'Review correction');
  const listed = (await service.listAccessGrants({ search: 'Junin' }))[0];
  assert.equal(listed.registrations[0].status, 'CONFIRMED');
  assert.equal(listed.registrations[0].paymentProofStoredName, originalProof.filename);
  assert.equal(listed.status, 'USED');
  await service.updateAccessGrantStatus(grant.id, { status: 'ACTIVE' });
  assert.equal((await service.getPublicAccessGrant(grant.token)).enabled, true);
  console.log('PASS: payments migration, additional proof required, both proofs readable, Caja 30000 + 15000, no duplicate payment,  reopen, private draft, correction, substitute, existing files/approval/fee, DNI identity, concurrent submissions and transaction rollback');
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => {
  for (const file of ownFiles) if (fs.existsSync(file)) fs.unlinkSync(file);
  if (ds?.isInitialized) await ds.destroy();
  if (created) await admin.query(`DROP DATABASE "${testDatabase}"`);
  await admin.end();
});
