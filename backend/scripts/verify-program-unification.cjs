// Run after npm run build. Uses a disposable local PostgreSQL database only.
require('dotenv').config({ path: require('node:path').join(__dirname, '../.env') });
require('reflect-metadata');
const assert = require('node:assert/strict');
const { Client } = require('pg');
const { DataSource } = require('typeorm');
const { readdirSync } = require('node:fs');
const path = require('node:path');
const { buildStandaloneDataSourceOptions } = require('../dist/database/typeorm.config');
const { TournamentsService } = require('../dist/tournaments/tournaments.service');
const { TournamentQueryService } = require('../dist/tournaments/tournament-query.service');
const { LinkProgramToMatches1789948800000 } = require('../dist/database/migrations/1789948800000-LinkProgramToMatches');
const options = buildStandaloneDataSourceOptions();
assert(['localhost', '127.0.0.1', '::1'].includes(options.host), 'This check requires a local database');
const testDatabase = `copa_program_test_${Date.now()}`;
const admin = new Client({ host: options.host, port: options.port, user: options.username, password: options.password, database: options.database });
let ds;
let created = false;
const entity = (folder, file, name) => require(`../dist/${folder}/${file}`)[name];
const Tournament = entity('tournaments', 'tournament.entity', 'Tournament');
const Category = entity('categories', 'category.entity', 'Category');
const TournamentCategory = entity('tournaments', 'tournament-category.entity', 'TournamentCategory');
const Zone = entity('tournaments', 'zone.entity', 'Zone');
const ZoneEntry = entity('tournaments', 'zone-entry.entity', 'ZoneEntry');
const Match = entity('tournaments', 'tournament-match.entity', 'TournamentMatch');
const Slot = entity('tournaments', 'tournament-schedule-slot.entity', 'TournamentScheduleSlot');
const Court = entity('courts', 'court.entity', 'Court');
const Venue = entity('courts', 'venue.entity', 'Venue');
const Assignment = entity('courts', 'court-assistant-assignment.entity', 'CourtAssistantAssignment');
const Registration = entity('registrations', 'pair-registration.entity', 'PairRegistration');
const Grant = entity('registrations', 'registration-access-grant.entity', 'RegistrationAccessGrant');
const director = { role: 'DIRECTOR' };
async function main() {
  await admin.connect();
  await admin.query(`CREATE DATABASE "${testDatabase}"`); created = true;
  const dir = path.join(__dirname, '../dist/database/migrations');
  const migrations = readdirSync(dir).filter((file) => file.endsWith('.js') && !file.startsWith('1789948800000')).flatMap((file) => Object.values(require(path.join(dir, file))));
  ds = await new DataSource({ ...options, database: testDatabase, synchronize: false, logging: false, migrations }).initialize();
  await ds.runMigrations({ transaction: 'each' });
  const save = (type, data) => ds.getRepository(type).save(ds.getRepository(type).create(data));
  const category = await save(Category, { name: 'Program Test' });
  const venue = await save(Venue, { name: 'Club Test', startsAt: '10:00', matchesPerDay: 80 });
  const courts = await Promise.all([1, 2].map((number) => save(Court, { name: `Cancha ${number}`, venueId: venue.id })));
  const tournament = await save(Tournament, { name: 'Unified test', playingDays: ['2026-11-20', '2026-11-21'], status: 'ACTIVE' });
  const tc = await save(TournamentCategory, { tournamentId: tournament.id, categoryId: category.id });
  const zones = [];
  for (const name of ['A', 'B', 'C', 'D']) zones.push(await save(Zone, { name, capacity: 4, venueId: venue.id, tournamentCategoryId: tc.id }));
  // Old data before the linking migration: fixture and planning record had different times.
  const [oldMatch] = await ds.query(`INSERT INTO tournament_matches ("zoneId", "matchOrder", status, "scheduledAt") VALUES ($1, 1, 'PENDING', '2026-11-20T16:00:00Z') RETURNING id`, [zones[0].id]);
  await ds.query(`INSERT INTO tournament_schedule_slots ("tournamentId", "tournamentCategoryId", "zoneName", "matchOrder", sequence, "courtId", "scheduledAt") VALUES ($1, $2, 'A', 1, 1, $3, '2026-11-20T13:00:00Z')`, [tournament.id, tc.id, courts[1].id]);
  const runner = ds.createQueryRunner();
  await runner.connect(); await runner.startTransaction();
  await new LinkProgramToMatches1789948800000().up(runner);
  const [linked] = await runner.query(`SELECT "matchId", "scheduledAt", "courtId" FROM tournament_schedule_slots`);
  assert.equal(linked.matchId, oldMatch.id);
  assert.equal(linked.scheduledAt.toISOString(), '2026-11-20T16:00:00.000Z');
  assert.equal(linked.courtId, courts[1].id);
  await new LinkProgramToMatches1789948800000().down(runner);
  await runner.rollbackTransaction(); await runner.release();
  const migrationRunner = ds.createQueryRunner(); await migrationRunner.connect();
  await migrationRunner.startTransaction(); await new LinkProgramToMatches1789948800000().up(migrationRunner); await migrationRunner.commitTransaction(); await migrationRunner.release();
  // Complete the old partial fixture for this migration scenario.
  for (const order of [2, 3, 4]) await save(Match, { zoneId: zones[0].id, matchOrder: order, status: 'PENDING', homeSource: 'DIRECT', awaySource: 'DIRECT' });
  const service = new TournamentsService(...[Tournament, TournamentCategory, Zone, ZoneEntry, Match, Slot, Court, Venue, Assignment, Registration].map((type) => ds.getRepository(type)));
  const program = await service.scheduleGrid(tournament.id);
  assert.equal(program.length, 23); // 16 zone games + 4 quarters + 2 semis + final.
  assert(program.every((slot) => slot.matchId && slot.match));
  assert.equal(new Set(program.map((slot) => slot.matchId)).size, 23);
  assert.equal(program.find((slot) => slot.matchId === oldMatch.id).scheduledAt.toISOString(), '2026-11-20T16:00:00.000Z');
  const programIds = program.map((slot) => slot.matchId);
  const simultaneous = await Promise.all([service.scheduleGrid(tournament.id), service.scheduleGrid(tournament.id)]);
  assert(simultaneous.every((items) => items.length === 23));
  assert.equal(await ds.getRepository(Match).count(), 23);
  assert.deepEqual((await service.scheduleGrid(tournament.id)).map((slot) => slot.matchId), programIds);
  await ds.getRepository(Zone).update(zones[0].id, { name: 'A renamed' });
  assert.equal((await service.scheduleGrid(tournament.id)).length, 23);
  assert.equal((await service.scheduleGrid(tournament.id)).find((slot) => slot.matchId === oldMatch.id).zoneName, 'A renamed');
  await service.schedule(oldMatch.id, '2026-11-20T17:00:00Z', director);
  assert.equal((await service.scheduleGrid(tournament.id)).find((slot) => slot.matchId === oldMatch.id).scheduledAt.toISOString(), '2026-11-20T17:00:00.000Z');
  await service.updateScheduleSlot(program[0].id, { courtId: courts[0].id, scheduledAt: '2026-11-20T18:00:00Z' });
  const zoneView = await service.matches(zones[0].id);
  assert.equal(zoneView[0].court.id, courts[0].id);
  assert.equal(zoneView[0].scheduledAt.toISOString(), '2026-11-20T18:00:00.000Z');
  const publicService = new TournamentQueryService(...[Tournament, TournamentCategory, Zone, ZoneEntry, Registration, Match, Court].map((type) => ds.getRepository(type)));
  const publicView = await publicService.currentPublic();
  assert.equal(publicView.tournament.zones.find((zone) => zone.id === zones[0].id).matches[0].scheduledAt.toISOString(), '2026-11-20T18:00:00.000Z');
  // Fill the real fixtures, then use results to qualify and advance the knockout bracket.
  for (const zone of zones) {
    for (let seed = 1; seed <= 4; seed++) {
      const grant = await save(Grant, { token: `TEST-${zone.id}-${seed}`, categoryId: category.id, localityName: 'Team', provinceName: 'BA', clubName: 'Club' });
      const registration = await save(Registration, { accessGrantId: grant.id, categoryId: category.id, localityName: `Team ${zone.id}-${seed}`, provinceName: 'BA', clubName: 'Club', heardAboutSource: 'CLUB', representingText: 'Team', playerOneName: 'One', playerOneDni: `${zone.id}${seed}1`, playerOneBirthDate: '1980-01-01', playerOnePhone: '111', playerOneShirtSize: 'M', playerTwoName: 'Two', playerTwoDni: `${zone.id}${seed}2`, playerTwoBirthDate: '1980-01-01', playerTwoPhone: '222', playerTwoShirtSize: 'M', status: 'CONFIRMED' });
      await service.assignPlace(zone.id, registration.id, seed);
    }
    const matches = await service.matches(zone.id);
    // This synthetic legacy zone lacked source metadata; fill that before exercising results.
    if (zone.id === zones[0].id) {
      await ds.getRepository(Match).update(matches[2].id, { homeSource: 'WINNER', homeSourceMatchId: matches[0].id, awaySource: 'LOSER', awaySourceMatchId: matches[1].id });
      await ds.getRepository(Match).update(matches[3].id, { homeSource: 'WINNER', homeSourceMatchId: matches[1].id, awaySource: 'LOSER', awaySourceMatchId: matches[0].id });
    }
    for (const match of matches) await service.result(match.id, 25, 10, director);
  }
  const qualified = await service.scheduleGrid(tournament.id);
  assert(qualified.filter((slot) => slot.stage === 'ZONE').every((slot) => slot.match.status === 'PLAYED'));
  const quarters = qualified.filter((slot) => slot.stage === 'QUARTERFINAL');
  assert(quarters.every((slot) => slot.match.status === 'READY'));
  assert.deepEqual(quarters.map((slot) => [slot.match.homeQualifierZoneId, slot.match.awayQualifierZoneId]), [[zones[0].id, zones[1].id], [zones[1].id, zones[0].id], [zones[2].id, zones[3].id], [zones[3].id, zones[2].id]]);
  for (const slot of quarters) await service.result(slot.matchId, 25, 10, director);
  const semis = (await service.scheduleGrid(tournament.id)).filter((slot) => slot.stage === 'SEMIFINAL');
  assert(semis.every((slot) => slot.match.status === 'READY'));
  for (const slot of semis) await service.result(slot.matchId, 25, 10, director);
  const final = (await service.scheduleGrid(tournament.id)).find((slot) => slot.stage === 'FINAL');
  assert.equal(final.match.status, 'READY');
  await service.result(final.matchId, 25, 10, director);
  await service.result(final.matchId, 25, 10, director); // Retried submission is harmless.
  await assert.rejects(() => service.result(final.matchId, 10, 25, director), /ya tiene un resultado/);
  assert.equal((await service.scheduleGrid(tournament.id)).find((slot) => slot.stage === 'FINAL').match.status, 'PLAYED');
  // Preview a new four-zone, three-pair category against an existing real program.
  const scenarioTournament = await save(Tournament, { name: 'Scenario test', playingDays: ['2026-11-20', '2026-11-21'] });
  const scenarioZones = [], scenarioCategories = [];
  const addScenarioCategory = async (capacity) => {
    const cat = await save(Category, { name: `Scenario ${scenarioCategories.length}` });
    const tc = await save(TournamentCategory, { tournamentId: scenarioTournament.id, categoryId: cat.id, zoneSize: capacity });
    scenarioCategories.push(tc);
    for (const name of ['A', 'B', 'C', 'D']) scenarioZones.push(await save(Zone, { name, capacity, venueId: venue.id, tournamentCategoryId: tc.id }));
    return tc;
  };
  await addScenarioCategory(4);
  await service.scheduleGrid(scenarioTournament.id);
  const snapshotScenario = () => ds.query('SELECT * FROM tournament_schedule_slots WHERE "tournamentId"=$1 ORDER BY id', [scenarioTournament.id]);
  const originalScenario = await snapshotScenario();
  const newCategory = await addScenarioCategory(3);
  const scenario = { mainDay: '2026-11-20', finalsDay: '2026-11-21', interleaveCategories: true, rules: [
    ...scenarioZones.map((z) => ({ categoryId: z.tournamentCategoryId, stage: 'ZONE', zoneId: z.id, venueId: venue.id, courtId: null, day: 'MAIN' })),
    ...scenarioCategories.flatMap((cat) => ['QUARTERFINAL', 'SEMIFINAL', 'FINAL'].map((stage) => ({ categoryId: cat.id, stage, venueId: venue.id, courtId: null, day: stage === 'QUARTERFINAL' ? 'MAIN' : 'FINALS' }))),
  ] };
  const simulation = await service.scenario(scenarioTournament.id, scenario);
  assert.equal(simulation.slots.length, 42);
  assert.equal(simulation.slots.filter((s) => s.tournamentCategoryId === newCategory.id && s.stage === 'ZONE').length, 12);
  assert.equal(simulation.warnings.length, 0);
  assert.deepEqual(await snapshotScenario(), originalScenario, 'Preview must not persist generated matches or scheduling');
  const appliedScenario = await service.scenario(scenarioTournament.id, { ...scenario, baseVersion: simulation.baseVersion }, true);
  assert.equal(appliedScenario.slots.length, 42);
  assert(appliedScenario.slots.every((s) => s.matchId && s.courtId && s.scheduledAt));
  assert(appliedScenario.slots.filter((s) => ['SEMIFINAL','FINAL'].includes(s.stage)).every((s) => s.scheduledAt.toISOString().startsWith('2026-11-21')));
  assert.deepEqual(appliedScenario.slots.filter((s) => originalScenario.some((o) => o.id === s.id)).map((s) => s.matchId), originalScenario.map((s) => s.matchId));
  await assert.rejects(() => service.scenario(scenarioTournament.id, { ...scenario, baseVersion: simulation.baseVersion }, true), /cambiaron/);
  const currentSimulation = await service.scenario(scenarioTournament.id, scenario);
  await assert.rejects(() => service.scenario(scenarioTournament.id, { ...scenario, interleaveCategories: false, baseVersion: currentSimulation.baseVersion }, true), /cambiaron/);
  const manualFinal = appliedScenario.slots.find((slot) => slot.stage === 'FINAL');
  const manualScenario = { ...scenario, overrides: [{ sequence: manualFinal.sequence, courtId: courts[0].id, scheduledAt: '2026-11-22T15:00:00.000Z' }] };
  const beforeManual = await snapshotScenario();
  const manualPreview = await service.scenario(scenarioTournament.id, manualScenario);
  assert.equal(manualPreview.warnings.length, 0);
  assert.deepEqual(await snapshotScenario(), beforeManual, 'Editing a manual time is still a preview');
  await service.scenario(scenarioTournament.id, { ...manualScenario, baseVersion: manualPreview.baseVersion }, true);
  assert.equal((await ds.getRepository(Slot).findOneBy({ id: manualFinal.id })).scheduledAt.toISOString(), '2026-11-22T15:00:00.000Z');
  const afterManual = await snapshotScenario();
  const opening = appliedScenario.slots.filter((slot) => slot.stage === 'ZONE' && slot.matchOrder === 1).slice(0, 2);
  const conflicting = { ...scenario, overrides: opening.map((slot) => ({ sequence: slot.sequence, courtId: courts[0].id, scheduledAt: '2026-11-20T13:00:00Z' })) };
  const conflictPreview = await service.scenario(scenarioTournament.id, conflicting);
  assert(conflictPreview.warnings.some((w) => w.message.includes('superpone')));
  await assert.rejects(() => service.scenario(scenarioTournament.id, { ...conflicting, baseVersion: conflictPreview.baseVersion }, true), /Hay partidos sin horario/);
  assert.deepEqual(await snapshotScenario(), afterManual, 'A conflicting manual scenario cannot change the saved program');
  const beforeRepartition = await snapshotScenario();
  const laterCategory = await addScenarioCategory(3);
  const withNewGames = await service.redistributeCourts(scenarioTournament.id);
  assert.equal(withNewGames.filter((s) => s.tournamentCategoryId === laterCategory.id).length, 19);
  assert(withNewGames.every((s) => s.matchId && s.courtId && s.scheduledAt));
  for (const old of beforeRepartition) assert.equal(withNewGames.find((s) => s.id === old.id).scheduledAt.toISOString(), old.scheduledAt.toISOString());
  assert.equal((await service.redistributeCourts(scenarioTournament.id)).length, 61, 'Repartition is idempotent');
  const chronological = [...withNewGames].sort((a,b) => a.scheduledAt - b.scheduledAt);
  for (const court of courts) {
    const games = chronological.filter((s) => s.courtId === court.id);
    for (let i=1;i<games.length;i++) assert(games[i].scheduledAt - games[i-1].scheduledAt >= venue.matchDurationMinutes*60_000, 'No court overlaps');
  }
  const smallTournament = await save(Tournament, { name: 'Three-pair test', playingDays: ['2026-11-20'] });
  const smallCategory = await save(TournamentCategory, { tournamentId: smallTournament.id, categoryId: category.id });
  const smallZone = await save(Zone, { name: 'A', capacity: 3, venueId: venue.id, tournamentCategoryId: smallCategory.id });
  const zoneFirst = await service.matches(smallZone.id);
  assert.equal(zoneFirst.length, 3);
  assert(zoneFirst.every((match) => match.scheduledAt && match.court));
  const smallProgram = await service.scheduleGrid(smallTournament.id);
  assert.equal(smallProgram.length, 3);
  assert(smallProgram.every((slot) => slot.scheduledAt && slot.court));
  assert.deepEqual(smallProgram.map((slot) => slot.matchId), zoneFirst.map((match) => match.id));
  assert.equal((await service.scheduleGrid(smallTournament.id)).length, 3);
  // Changing the zone configuration moves pending real games immediately.
  const destination = await save(Venue, { name: 'Gure Echea', startsAt: '10:00', matchesPerDay: 80 });
  const destinationCourt = await save(Court, { name: 'Cancha 1', venueId: destination.id });
  const beforeMove = (await service.scheduleGrid(smallTournament.id)).map((slot) => ({ id: slot.id, matchId: slot.matchId, time: slot.scheduledAt.toISOString() }));
  await service.updateZone(smallZone.id, { venueId: destination.id, name: 'Moved A' });
  let moved = await service.scheduleGrid(smallTournament.id);
  assert(moved.every((slot) => slot.courtId === destinationCourt.id));
  assert.deepEqual(moved.map((slot) => ({ id: slot.id, matchId: slot.matchId, time: slot.scheduledAt.toISOString() })), beforeMove);
  // Repartition repairs stale assignments made before this fix, using stable zone IDs.
  for (const slot of moved) await ds.getRepository(Slot).update(slot.id, { courtId: courts[0].id });
  moved = await service.redistributeCourts(smallTournament.id);
  assert(moved.every((slot) => slot.courtId === destinationCourt.id));
  // A second zone cannot be silently moved onto an occupied court at the same time.
  const anotherZone = await save(Zone, { name: 'B', capacity: 3, venueId: venue.id, tournamentCategoryId: smallCategory.id });
  const otherGames = await service.matches(anotherZone.id);
  const otherSlot = (await service.scheduleGrid(smallTournament.id)).find((slot) => slot.matchId === otherGames[0].id);
  await service.updateScheduleSlot(otherSlot.id, { courtId: courts[0].id, scheduledAt: moved[0].scheduledAt.toISOString() });
  await assert.rejects(() => service.updateZone(anotherZone.id, { venueId: destination.id }), /No hay una cancha activa disponible/);
  assert.equal((await ds.getRepository(Zone).findOneBy({ id: anotherZone.id })).venueId, venue.id);
  assert.equal((await ds.getRepository(Slot).findOneBy({ id: otherSlot.id })).courtId, courts[0].id);
  // Historical played games retain their original court while remaining games move.
  await ds.getRepository(Match).update(moved[0].matchId, { status: 'PLAYED', homeScore: 25, awayScore: 10 });
  await service.updateZone(smallZone.id, { venueId: venue.id });
  const afterPlayed = await service.scheduleGrid(smallTournament.id);
  assert.equal(afterPlayed.find((slot) => slot.id === moved[0].id).courtId, destinationCourt.id);
  assert(afterPlayed.filter((slot) => moved.slice(1).some((item) => item.id === slot.id)).every((slot) => slot.court.venueId === venue.id));
  console.log('PASS: migration up/down, legacy schedules, shared IDs, zone rename, both scheduling directions, pair assignment, quarterfinals, semifinals and final.');
}
main().catch((error) => { console.error(error.stack); process.exitCode = 1; }).finally(async () => {
  if (ds?.isInitialized) await ds.destroy();
  if (created) { assert(/^copa_program_test_\d+$/.test(testDatabase)); await admin.query(`DROP DATABASE "${testDatabase}" WITH (FORCE)`); }
  await admin.end();
});
