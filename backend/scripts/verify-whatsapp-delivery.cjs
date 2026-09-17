// Run after npm run build. No WhatsApp messages are sent; uses a disposable LOCAL database.
require('dotenv').config({ path: require('node:path').join(__dirname, '../.env') });
require('reflect-metadata');
const assert = require('node:assert/strict');
const { DataSource } = require('typeorm');
const { Client } = require('pg');
const { createHmac } = require('node:crypto');
const { buildStandaloneDataSourceOptions } = require('../dist/database/typeorm.config');
const { WhatsAppDelivery } = require('../dist/whatsapp/whatsapp-delivery.entity');
const { WhatsAppDeliveryService } = require('../dist/whatsapp/whatsapp-delivery.service');
const { WhatsAppService } = require('../dist/whatsapp/whatsapp.service');
const { WhatsAppController } = require('../dist/whatsapp/whatsapp.controller');
const { RegistrationsService } = require('../dist/registrations/registrations.service');
const { RegistrationAccessGrant } = require('../dist/registrations/registration-access-grant.entity');
const { Category } = require('../dist/categories/category.entity');
const options = buildStandaloneDataSourceOptions();
assert(['localhost', '127.0.0.1', '::1'].includes(options.host), 'Local database required');
const database = `copa_delivery_test_${Date.now()}`;
const admin = new Client({ host: options.host, port: options.port, user: options.username, password: options.password, database: options.database });
let ds, created = false;
async function main() {
  await admin.connect(); await admin.query(`CREATE DATABASE "${database}"`); created = true;
  ds = await new DataSource({ ...options, database, synchronize: false, logging: false }).initialize();
  await ds.runMigrations({ transaction: 'each' });
  const repo = ds.getRepository(WhatsAppDelivery);
  const delivery = new WhatsAppDeliveryService(repo);
  const service = new WhatsAppService({ get: key => key === 'WHATSAPP_APP_SECRET' ? 'test-secret' : '' }, delivery);
  const controller = new WhatsAppController(service);
  const category = await ds.getRepository(Category).save({ name: 'Test' });
  const grants = ds.getRepository(RegistrationAccessGrant);
  const grant = await grants.save({ token: 'COPA-TEST', categoryId: category.id, localityName: 'Team', provinceName: 'BA', clubName: 'Club', whatsappSentAt: new Date(), whatsappMessageId: 'wamid.first' });
  const registrations = new RegistrationsService(null, grants, null, null, null, null, null, null);
  const at = new Date('2026-09-16T19:50:00Z');
  await delivery.record('wamid.first', 'accepted', at);
  assert.equal((await registrations.listAccessGrants({}))[0].whatsappDelivery.status, 'accepted');
  const payload = { entry: [{ changes: [{ field: 'messages', value: { statuses: [{ id: 'wamid.first', status: 'delivered', timestamp: '1789588260' }] } }] }] };
  const rawBody = Buffer.from(JSON.stringify(payload));
  await assert.rejects(controller.receiveWebhook({ rawBody }, 'sha256=bad', payload), /Firma/);
  const signature = `sha256=${createHmac('sha256', 'test-secret').update(rawBody).digest('hex')}`;
  assert.deepEqual(await controller.receiveWebhook({ rawBody }, signature, payload), { received: true });
  await Promise.all([
    delivery.record('wamid.first', 'sent', new Date('2026-09-17')),
    delivery.record('wamid.first', 'read', new Date('2026-09-16T19:52:00Z')),
    delivery.record('wamid.first', 'accepted', new Date('2026-09-17')),
  ]);
  assert.equal((await repo.findOneByOrFail({ messageId: 'wamid.first' })).status, 'read');
  assert.equal(await repo.count(), 1);
  // An early webhook can precede the send response, without losing its error.
  await delivery.record('wamid.second', 'failed', at, 131049, 'Meta rejected delivery');
  await delivery.record('wamid.second', 'accepted', new Date('2026-09-17'));
  await grants.update(grant.id, { whatsappMessageId: 'wamid.second' });
  await delivery.record('wamid.first', 'delivered', new Date('2026-09-18'));
  const latest = (await registrations.listAccessGrants({}))[0];
  assert.equal(latest.whatsappDelivery.status, 'failed');
  assert.equal(latest.whatsappDelivery.errorCode, 131049);
  await delivery.record('wamid.second', 'delivered', new Date('2026-09-19'));
  assert.equal((await repo.findOneByOrFail({ messageId: 'wamid.second' })).errorCode, null);
  await grants.update(grant.id, { whatsappMessageId: null });
  assert.equal((await registrations.listAccessGrants({}))[0].whatsappDelivery, null);
  console.log('PASS: signed webhook, persisted status and error, duplicate/out-of-order events, early webhook, old resend isolation, legacy unconfirmed sends');
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (ds?.isInitialized) await ds.destroy();
  if (created) await admin.query(`DROP DATABASE "${database}"`);
  await admin.end();
});
