import { useState } from 'react';
import shirtSizeGuideImage from '../assets/shirt-size-guide.svg';
import { createPublicRegistration, getPublicRegistrationAccess } from '../lib/api';
import { categoryLabels, heardAboutLabels, shirtSizeLabels } from '../lib/content';
import type {
  HeardAboutSource,
  PublicAccessGrant,
  PublicRegistrationPayload,
  ShirtSize,
} from '../types';

const initialForm: PublicRegistrationPayload = {
  accessToken: '',
  heardAboutSource: 'INSTAGRAM',
  heardAboutOtherText: '',
  tournamentAvailabilityConfirmed: true,
  representingText: '',
  contactEmail: '',
  playerOneName: '',
  playerOneDni: '',
  playerOneBirthDate: '',
  playerOnePhone: '',
  playerOneInstagram: '',
  playerOneShirtSize: 'M',
  playerTwoName: '',
  playerTwoDni: '',
  playerTwoBirthDate: '',
  playerTwoPhone: '',
  playerTwoInstagram: '',
  playerTwoShirtSize: 'M',
  playerThreeName: '',
  playerThreeDni: '',
  playerThreeBirthDate: '',
  playerThreePhone: '',
  playerThreeInstagram: '',
  playerThreeShirtSize: 'M',
};

type PlayerFieldPrefix = 'playerOne' | 'playerTwo' | 'playerThree';

export function RegistrationPage() {
  const [tokenInput, setTokenInput] = useState('');
  const [access, setAccess] = useState<PublicAccessGrant | null>(null);
  const [loadingAccess, setLoadingAccess] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [paymentProof, setPaymentProof] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const updateField = <K extends keyof PublicRegistrationPayload>(
    field: K,
    value: PublicRegistrationPayload[K],
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const resetForm = () => {
    setAccess(null);
    setTokenInput('');
    setForm(initialForm);
    setPaymentProof(null);
    setError(null);
  };

  const handleTokenSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoadingAccess(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const result = await getPublicRegistrationAccess(tokenInput.trim());

      if (!result.enabled) {
        throw new Error('Este token ya fue utilizado o fue revocado.');
      }

      setAccess(result);
      setForm((current) => ({
        ...current,
        accessToken: result.token,
        representingText: `${result.localityName}, ${result.provinceName}`,
      }));
    } catch (reason) {
      setAccess(null);
      setError(reason instanceof Error ? reason.message : 'No se pudo validar el token.');
    } finally {
      setLoadingAccess(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const result = await createPublicRegistration({
        ...form,
        paymentProof: paymentProof ?? undefined,
        heardAboutOtherText: form.heardAboutOtherText?.trim() || undefined,
        contactEmail: form.contactEmail?.trim() || undefined,
        playerOneInstagram: form.playerOneInstagram?.trim() || undefined,
        playerTwoInstagram: form.playerTwoInstagram?.trim() || undefined,
        playerThreeName: form.playerThreeName?.trim() || undefined,
        playerThreeDni: form.playerThreeDni?.trim() || undefined,
        playerThreeBirthDate: form.playerThreeBirthDate?.trim() || undefined,
        playerThreePhone: form.playerThreePhone?.trim() || undefined,
        playerThreeInstagram: form.playerThreeInstagram?.trim() || undefined,
      });

      setSuccessMessage(`${result.message}. Codigo interno #${result.id}.`);
      resetForm();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo enviar la inscripcion.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="registration-band registration-band-stacked">
      <div className="registration-copy">
        <p className="eyebrow">Inscripcion con token</p>
        <h1>Solo se registran localidades habilitadas por Direccion del Torneo</h1>
        <p>
          Primero ingresas el token entregado por la organizacion. Si el token esta activo, se
          abre el formulario para cargar hasta 3 jugadoras y completar la inscripcion.
        </p>
      </div>

      <form className="token-card" onSubmit={handleTokenSubmit}>
        <label>
          Token de habilitacion
          <input
            value={tokenInput}
            onChange={(event) => setTokenInput(event.target.value.toUpperCase())}
            placeholder="COPA-XXXXXXX"
            required
          />
        </label>
        <button type="submit" className="primary-button" disabled={loadingAccess}>
          {loadingAccess ? 'Validando...' : 'Validar token'}
        </button>
      </form>

      {error ? <p className="form-error">{error}</p> : null}
      {successMessage ? <p className="form-success">{successMessage}</p> : null}

      {access ? (
        <>
          <section className="grant-card">
            <div>
              <p className="eyebrow">Localidad habilitada</p>
              <h2>{access.localityName}</h2>
              <p>
                {categoryLabels[access.category]} - {access.provinceName}
              </p>
              {access.feeWaived ? <p>Inscripcion bonificada por la organizacion.</p> : null}
            </div>
            <button type="button" className="secondary-button" onClick={resetForm}>
              Cambiar token
            </button>
          </section>

          <form className="registration-form registration-form-wide" onSubmit={handleSubmit}>
            <div className="form-section span-2">
              <h3>Confirmaciones</h3>
              <label>
                Como te enteraste de este evento
                <select
                  value={form.heardAboutSource}
                  onChange={(event) =>
                    updateField('heardAboutSource', event.target.value as HeardAboutSource)
                  }
                >
                  {Object.entries(heardAboutLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              {form.heardAboutSource === 'OTHER' ? (
                <label>
                  Otro medio
                  <input
                    value={form.heardAboutOtherText}
                    onChange={(event) => updateField('heardAboutOtherText', event.target.value)}
                    required
                  />
                </label>
              ) : null}
              <label className="checkbox-row span-2">
                <input
                  type="checkbox"
                  checked={form.tournamentAvailabilityConfirmed}
                  onChange={(event) =>
                    updateField('tournamentAvailabilityConfirmed', event.target.checked)
                  }
                />
                Confirmo disponibilidad para jugar el 21 y 22 de noviembre de 2026.
              </label>
              <label className="span-2">
                Ciudad y/o provincia que representan
                <input
                  value={form.representingText}
                  onChange={(event) => updateField('representingText', event.target.value)}
                  required
                />
              </label>
              <label className="span-2">
                Email de contacto
                <input
                  type="email"
                  value={form.contactEmail}
                  onChange={(event) => updateField('contactEmail', event.target.value)}
                />
              </label>
            </div>

            <PlayerFields
              title="Delantera"
              fieldPrefix="playerOne"
              name={form.playerOneName}
              dni={form.playerOneDni}
              birthDate={form.playerOneBirthDate}
              phone={form.playerOnePhone}
              instagram={form.playerOneInstagram ?? ''}
              shirtSize={form.playerOneShirtSize}
              required
              onChange={(field, value) => updateField(field, value)}
            />

            <PlayerFields
              title="Zaguera"
              fieldPrefix="playerTwo"
              name={form.playerTwoName}
              dni={form.playerTwoDni}
              birthDate={form.playerTwoBirthDate}
              phone={form.playerTwoPhone}
              instagram={form.playerTwoInstagram ?? ''}
              shirtSize={form.playerTwoShirtSize}
              required
              onChange={(field, value) => updateField(field, value)}
            />

            <PlayerFields
              title="Jugadora 3"
              optionalCaption="Si la hubiera"
              fieldPrefix="playerThree"
              name={form.playerThreeName ?? ''}
              dni={form.playerThreeDni ?? ''}
              birthDate={form.playerThreeBirthDate ?? ''}
              phone={form.playerThreePhone ?? ''}
              instagram={form.playerThreeInstagram ?? ''}
              shirtSize={(form.playerThreeShirtSize ?? 'M') as ShirtSize}
              onChange={(field, value) => updateField(field, value)}
            />

            <div className="form-section span-2" id="guia-talles">
              <h3>Camiseta de la Copa</h3>
              <p>Al abonar la inscripcion, la organizacion entrega una camiseta oficial.</p>
              <a className="guide-link" href={shirtSizeGuideImage} target="_blank" rel="noreferrer">
                Abrir guia de talles en grande
              </a>
              <figure className="shirt-guide-figure">
                <img
                  src={shirtSizeGuideImage}
                  alt="Guia de talles de camiseta Damas para Copa Leyendas"
                />
              </figure>
            </div>

            <div className="form-section span-2">
              <h3>Inscripcion y comprobante</h3>
              <p>$15.000 por cada jugadora. 2 jugadoras: $30.000. 3 jugadoras: $45.000.</p>
              {access.feeWaived ? (
                <div className="inline-state inline-state-success">
                  Esta inscripcion fue bonificada por la organizacion. No hace falta adjuntar
                  comprobante.
                </div>
              ) : (
                <>
                  <p>
                    Transferir al alias `copaleyendas`, titular Renato Jose Meritano, Uala Bank.
                  </p>
                  <label className="span-2">
                    Subir captura del comprobante de pago
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(event) => setPaymentProof(event.target.files?.[0] ?? null)}
                      required
                    />
                  </label>
                </>
              )}
            </div>

            <div className="span-2 form-actions">
              <button type="submit" className="primary-button" disabled={submitting}>
                {submitting ? 'Enviando...' : 'Enviar inscripcion'}
              </button>
            </div>
          </form>
        </>
      ) : null}
    </section>
  );
}

function PlayerFields(props: {
  title: string;
  optionalCaption?: string;
  name: string;
  dni: string;
  birthDate: string;
  phone: string;
  instagram: string;
  shirtSize: ShirtSize;
  required?: boolean;
  fieldPrefix: PlayerFieldPrefix;
  onChange: (field: keyof PublicRegistrationPayload, value: string) => void;
}) {
  const isOptional = !props.required;
  const hasName = props.name.trim().length > 0;
  const shouldRequire = props.required || hasName;

  return (
    <div className="form-section span-2">
      <h3>
        {props.title}
        {props.optionalCaption ? ` (${props.optionalCaption})` : ''}
      </h3>
      <div className="player-grid">
        <label>
          Nombres y apellidos
          <input
            value={props.name}
            onChange={(event) =>
              props.onChange(
                `${props.fieldPrefix}Name` as keyof PublicRegistrationPayload,
                event.target.value,
              )
            }
            required={Boolean(shouldRequire)}
          />
        </label>
        <label>
          DNI
          <input
            value={props.dni}
            onChange={(event) =>
              props.onChange(
                `${props.fieldPrefix}Dni` as keyof PublicRegistrationPayload,
                event.target.value,
              )
            }
            required={Boolean(shouldRequire)}
          />
        </label>
        <label>
          Fecha de nacimiento
          <input
            type="date"
            value={props.birthDate}
            onChange={(event) =>
              props.onChange(
                `${props.fieldPrefix}BirthDate` as keyof PublicRegistrationPayload,
                event.target.value,
              )
            }
            required={Boolean(shouldRequire)}
          />
        </label>
        <label>
          Celular
          <input
            value={props.phone}
            onChange={(event) =>
              props.onChange(
                `${props.fieldPrefix}Phone` as keyof PublicRegistrationPayload,
                event.target.value,
              )
            }
            required={Boolean(shouldRequire)}
          />
        </label>
        <label>
          Instagram
          <input
            value={props.instagram}
            onChange={(event) =>
              props.onChange(
                `${props.fieldPrefix}Instagram` as keyof PublicRegistrationPayload,
                event.target.value,
              )
            }
          />
        </label>
        <label>
          <span className="field-label-row">
            <span>Talle de camiseta</span>
            <a className="guide-link" href="#guia-talles">
              Ver guia
            </a>
          </span>
          <select
            value={props.shirtSize}
            onChange={(event) =>
              props.onChange(
                `${props.fieldPrefix}ShirtSize` as keyof PublicRegistrationPayload,
                event.target.value,
              )
            }
            required={!isOptional || hasName}
          >
            {shirtSizeLabels.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
