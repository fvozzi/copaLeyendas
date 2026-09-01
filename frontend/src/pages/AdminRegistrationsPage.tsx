import { useEffect, useState } from 'react';
import {
  createAccessGrant,
  getAccessGrants,
  getLocalities,
  getRegistrations,
  openRegistrationPaymentProof,
  updateAccessGrantStatus,
  updateRegistrationStatus,
} from '../lib/api';
import {
  accessGrantStatusLabels,
  categoryLabels,
  heardAboutLabels,
  registrationStatusLabels,
} from '../lib/content';
import type {
  AccessGrantPayload,
  AccessGrantStatus,
  PairRegistration,
  RegistrationAccessGrant,
  RegistrationStatus,
} from '../types';

type RegistrationDraftState = Record<number, { status: RegistrationStatus; adminNotes: string }>;

const initialGrantForm: AccessGrantPayload = {
  category: 'DAMAS_A',
  localityName: '',
  provinceName: '',
  contactName: '',
  contactEmail: '',
  contactPhone: '',
  notes: '',
  feeWaived: false,
};

export function AdminRegistrationsPage() {
  const [grants, setGrants] = useState<RegistrationAccessGrant[]>([]);
  const [localities, setLocalities] = useState<import('../types').Locality[]>([]);
  const [registrations, setRegistrations] = useState<PairRegistration[]>([]);
  const [registrationDrafts, setRegistrationDrafts] = useState<RegistrationDraftState>({});
  const [grantForm, setGrantForm] = useState<AccessGrantPayload>(initialGrantForm);
  const [grantStatus, setGrantStatus] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadAll = () => {
    setError(null);

    getAccessGrants({
      category: category || undefined,
      status: grantStatus || undefined,
      search: search || undefined,
    })
      .then(setGrants)
      .catch((reason: Error) => setError(reason.message));

    getRegistrations({
      category: category || undefined,
      status: status || undefined,
      search: search || undefined,
    })
      .then((items) => {
        setRegistrations(items);
        setRegistrationDrafts(
          Object.fromEntries(
            items.map((item) => [
              item.id,
              {
                status: item.status,
                adminNotes: item.adminNotes ?? '',
              },
            ]),
          ),
        );
      })
      .catch((reason: Error) => setError(reason.message));
  };

  useEffect(() => {
    loadAll();
  }, [category, status, grantStatus]);

  useEffect(() => {
    getLocalities().then(setLocalities).catch((reason: Error) => setError(reason.message));
  }, []);

  const setGrantField = <K extends keyof AccessGrantPayload>(
    field: K,
    value: AccessGrantPayload[K],
  ) => {
    setGrantForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleCreateGrant = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      const created = await createAccessGrant(grantForm);
      setSuccess(`Token generado: ${created.token}`);
      setGrantForm(initialGrantForm);
      loadAll();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo generar el token.');
    }
  };

  const copyToken = async (token: string) => {
    await navigator.clipboard.writeText(token);
    setSuccess(`Token copiado: ${token}`);
  };

  const changeGrantStatus = async (id: number, newStatus: AccessGrantStatus) => {
    await updateAccessGrantStatus(id, { status: newStatus });
    loadAll();
  };

  const updateDraft = (id: number, field: 'status' | 'adminNotes', value: string) => {
    setRegistrationDrafts((current) => ({
      ...current,
      [id]: {
        ...current[id],
        [field]: value,
      },
    }));
  };

  const saveRegistrationDraft = async (id: number) => {
    const draft = registrationDrafts[id];
    await updateRegistrationStatus(id, draft);
    setSuccess('Seguimiento actualizado.');
    loadAll();
  };

  return (
    <div className="admin-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Direccion del Torneo</p>
          <h1>Habilitaciones e inscripciones</h1>
        </div>
      </div>

      {error ? <div className="inline-state">{error}</div> : null}
      {success ? <div className="inline-state inline-state-success">{success}</div> : null}

      <div className="admin-grid admin-grid-wide">
        <section className="data-card">
          <h2>Nueva habilitacion</h2>
          <form className="editor-form compact-form" onSubmit={handleCreateGrant}>
            <label className="span-2">
              Localidad / equipo habilitado
              <select
                value={grantForm.localityId ?? ''}
                onChange={(event) => setGrantField('localityId', Number(event.target.value))}
                required
              >
                <option value="">Seleccionar equipo</option>
                {localities.filter((locality) => locality.active && locality.category?.active).map((locality) => (
                  <option key={locality.id} value={locality.id}>
                    {locality.name}, {locality.provinceName} - {locality.category?.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Categoria
              <select
                value={grantForm.category}
                onChange={(event) =>
                  setGrantField('category', event.target.value as AccessGrantPayload['category'])
                }
              >
                {Object.entries(categoryLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Localidad
              <input
                value={grantForm.localityName}
                onChange={(event) => setGrantField('localityName', event.target.value)}
                required
              />
            </label>
            <label>
              Provincia
              <input
                value={grantForm.provinceName}
                onChange={(event) => setGrantField('provinceName', event.target.value)}
                required
              />
            </label>
            <label>
              Contacto
              <input
                value={grantForm.contactName}
                onChange={(event) => setGrantField('contactName', event.target.value)}
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={grantForm.contactEmail}
                onChange={(event) => setGrantField('contactEmail', event.target.value)}
              />
            </label>
            <label>
              Telefono
              <input
                value={grantForm.contactPhone}
                onChange={(event) => setGrantField('contactPhone', event.target.value)}
              />
            </label>
            <label className="span-2">
              Notas
              <textarea
                rows={3}
                value={grantForm.notes}
                onChange={(event) => setGrantField('notes', event.target.value)}
              />
            </label>
            <label className="checkbox-row span-2">
              <input
                type="checkbox"
                checked={Boolean(grantForm.feeWaived)}
                onChange={(event) => setGrantField('feeWaived', event.target.checked)}
              />
              Inscripcion bonificada por la organizacion
            </label>
            <div className="span-2 form-actions">
              <button type="submit" className="primary-button">
                Generar token
              </button>
            </div>
          </form>
        </section>

        <section className="data-card">
          <h2>Filtros</h2>
          <div className="toolbar toolbar-stack">
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="">Todas las categorias</option>
              {Object.entries(categoryLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select value={grantStatus} onChange={(event) => setGrantStatus(event.target.value)}>
              <option value="">Todos los tokens</option>
              {Object.entries(accessGrantStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">Todos los registros</option>
              {Object.entries(registrationStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <input
              placeholder="Buscar por token, localidad o jugadora"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <button type="button" className="secondary-button" onClick={loadAll}>
              Actualizar
            </button>
          </div>
        </section>
      </div>

      <section className="data-card">
        <h2>Tokens emitidos</h2>
        <div className="list-grid">
          {grants.map((grant) => (
            <article key={grant.id} className="list-card">
              <div className="list-card-header">
                <div>
                  <p className="post-section">{categoryLabels[grant.category]}</p>
                  <h2>{grant.localityName}</h2>
                </div>
                <span
                  className={`status-chip ${
                    grant.status === 'ACTIVE'
                      ? 'status-live'
                      : grant.status === 'USED'
                        ? 'status-review'
                        : 'status-draft'
                  }`}
                >
                  {accessGrantStatusLabels[grant.status]}
                </span>
              </div>
              <p>{grant.provinceName}</p>
              <p>Token: {grant.token}</p>
              {grant.feeWaived ? <p>Inscripcion bonificada</p> : null}
              {grant.contactName ? <p>Contacto: {grant.contactName}</p> : null}
              <div className="list-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => copyToken(grant.token)}
                >
                  Copiar token
                </button>
                {grant.status === 'ACTIVE' ? (
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => changeGrantStatus(grant.id, 'REVOKED')}
                  >
                    Revocar
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="data-card">
        <h2>Registros recibidos</h2>
        <div className="list-grid">
          {registrations.map((registration) => (
            <article key={registration.id} className="list-card">
              <div className="list-card-header">
                <div>
                  <p className="post-section">{categoryLabels[registration.category]}</p>
                  <h2>
                    {registration.playerOneName} / {registration.playerTwoName}
                  </h2>
                </div>
                <span className="status-chip status-review">
                  {registrationStatusLabels[
                    registrationDrafts[registration.id]?.status ?? registration.status
                  ]}
                </span>
              </div>
              <p>
                {registration.localityName}, {registration.provinceName}
              </p>
              <p>Representan: {registration.representingText}</p>
              <p>Fuente: {heardAboutLabels[registration.heardAboutSource]}</p>
              <p>{registration.feeWaived ? 'Inscripcion bonificada' : 'Inscripcion con comprobante'}</p>
              <p>
                Titulares: {registration.playerOnePhone} / {registration.playerTwoPhone}
              </p>
              {registration.playerThreeName ? (
                <p>Jugadora 3: {registration.playerThreeName}</p>
              ) : null}
              <label>
                Estado
                <select
                  value={registrationDrafts[registration.id]?.status ?? registration.status}
                  onChange={(event) =>
                    updateDraft(
                      registration.id,
                      'status',
                      event.target.value as RegistrationStatus,
                    )
                  }
                >
                  {Object.entries(registrationStatusLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Nota interna
                <textarea
                  rows={4}
                  value={registrationDrafts[registration.id]?.adminNotes ?? ''}
                  onChange={(event) =>
                    updateDraft(registration.id, 'adminNotes', event.target.value)
                  }
                />
              </label>
              <div className="list-actions">
                {!registration.feeWaived ? (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => openRegistrationPaymentProof(registration.id)}
                  >
                    Ver comprobante
                  </button>
                ) : null}
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => saveRegistrationDraft(registration.id)}
                >
                  Guardar seguimiento
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
