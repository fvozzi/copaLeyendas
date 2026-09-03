import { useState } from 'react';
import shirtSizeGuideImage from '../assets/shirt-size-guide.png';
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
  playerOneHasCommercialAgreement: false,
  playerOneCommercialAgreementDetails: '',
  playerTwoName: '',
  playerTwoDni: '',
  playerTwoBirthDate: '',
  playerTwoPhone: '',
  playerTwoInstagram: '',
  playerTwoShirtSize: 'M',
  playerTwoHasCommercialAgreement: false,
  playerTwoCommercialAgreementDetails: '',
  playerThreeName: '',
  playerThreeDni: '',
  playerThreeBirthDate: '',
  playerThreePhone: '',
  playerThreeInstagram: '',
  playerThreeShirtSize: 'M',
  playerThreeHasCommercialAgreement: false,
  playerThreeCommercialAgreementDetails: '',
};

type PlayerFieldPrefix = 'playerOne' | 'playerTwo' | 'playerThree';
type PlayerPhotos = Record<PlayerFieldPrefix, File | null>;
type FieldErrors = Record<string, string | undefined>;
const initialPlayerPhotos: PlayerPhotos = { playerOne: null, playerTwo: null, playerThree: null };

export function RegistrationPage() {
  const [tokenInput, setTokenInput] = useState('');
  const [access, setAccess] = useState<PublicAccessGrant | null>(null);
  const [loadingAccess, setLoadingAccess] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [paymentProof, setPaymentProof] = useState<File | null>(null);
  const [playerPhotos, setPlayerPhotos] = useState<PlayerPhotos>(initialPlayerPhotos);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const updateField = <K extends keyof PublicRegistrationPayload>(
    field: K,
    value: PublicRegistrationPayload[K],
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  };

  const resetForm = () => {
    setAccess(null);
    setTokenInput('');
    setForm(initialForm);
    setPaymentProof(null);
    setPlayerPhotos(initialPlayerPhotos);
    setError(null);
    setFieldErrors({});
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
    setError(null);
    const errors = validateRegistration(form, paymentProof, access?.feeWaived ?? false);
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      setError('Revisa los campos marcados para continuar.');
      return;
    }
    setSubmitting(true);
    setSuccessMessage(null);
    setFieldErrors({});

    try {
      const result = await createPublicRegistration({
        ...form,
        paymentProof: paymentProof ?? undefined,
        playerOnePhoto: playerPhotos.playerOne ?? undefined,
        playerTwoPhoto: playerPhotos.playerTwo ?? undefined,
        playerThreePhoto: form.playerThreeName?.trim() ? playerPhotos.playerThree ?? undefined : undefined,
        heardAboutOtherText: form.heardAboutOtherText?.trim() || undefined,
        contactEmail: form.contactEmail?.trim() || undefined,
        playerOneInstagram: form.playerOneInstagram?.trim() || undefined,
        playerTwoInstagram: form.playerTwoInstagram?.trim() || undefined,
        playerThreeName: form.playerThreeName?.trim() || undefined,
        playerThreeDni: form.playerThreeDni?.trim() || undefined,
        playerThreeBirthDate: form.playerThreeBirthDate?.trim() || undefined,
        playerThreePhone: form.playerThreePhone?.trim() || undefined,
        playerThreeInstagram: form.playerThreeInstagram?.trim() || undefined,
        playerOneCommercialAgreementDetails: form.playerOneCommercialAgreementDetails?.trim() || undefined,
        playerTwoCommercialAgreementDetails: form.playerTwoCommercialAgreementDetails?.trim() || undefined,
        playerThreeCommercialAgreementDetails: form.playerThreeCommercialAgreementDetails?.trim() || undefined,
      });

      setSuccessMessage(`${result.message}. Codigo interno #${result.id}.`);
      resetForm();
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'No se pudo enviar la inscripcion.';
      if (message.includes('413 Request Entity Too Large')) {
        setError('Los archivos seleccionados superan el limite permitido. Cada archivo debe pesar como maximo 10 MB.');
        return;
      }
      setFieldErrors(validationErrorsFromMessage(message));
      setError('No se pudo enviar la inscripcion. Revisa los campos marcados.');
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
          <p><strong>Consultas y asesoramiento con respecto al formulario</strong><br />Mel: (011) 37768403 / Sonia: (011) 69338065</p>
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

          <form className="registration-form registration-form-wide" onSubmit={handleSubmit} noValidate>
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
                <FieldError message={fieldErrors.heardAboutSource} />
              </label>
              {form.heardAboutSource === 'OTHER' ? (
                <label>
                  Otro medio
                  <input
                    value={form.heardAboutOtherText}
                    onChange={(event) => updateField('heardAboutOtherText', event.target.value)}
                  />
                  <FieldError message={fieldErrors.heardAboutOtherText} />
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
              <FieldError message={fieldErrors.tournamentAvailabilityConfirmed} />
              <label className="span-2">
                Ciudad y/o provincia que representan
                <input
                  value={form.representingText}
                  onChange={(event) => updateField('representingText', event.target.value)}
                />
                <FieldError message={fieldErrors.representingText} />
              </label>
              <label className="span-2">
                Email de contacto
                <input
                  type="email"
                  value={form.contactEmail}
                  onChange={(event) => updateField('contactEmail', event.target.value)}
                />
                <FieldError message={fieldErrors.contactEmail} />
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
              photo={playerPhotos.playerOne}
              onPhotoChange={(file) => setPlayerPhotos((current) => ({ ...current, playerOne: file }))}
              hasCommercialAgreement={form.playerOneHasCommercialAgreement}
              commercialAgreementDetails={form.playerOneCommercialAgreementDetails ?? ''}
              onCommercialAgreementChange={(hasAgreement, details) => setForm((current) => ({ ...current, playerOneHasCommercialAgreement: hasAgreement, playerOneCommercialAgreementDetails: details }))}
              errors={fieldErrors}
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
              photo={playerPhotos.playerTwo}
              onPhotoChange={(file) => setPlayerPhotos((current) => ({ ...current, playerTwo: file }))}
              hasCommercialAgreement={form.playerTwoHasCommercialAgreement}
              commercialAgreementDetails={form.playerTwoCommercialAgreementDetails ?? ''}
              onCommercialAgreementChange={(hasAgreement, details) => setForm((current) => ({ ...current, playerTwoHasCommercialAgreement: hasAgreement, playerTwoCommercialAgreementDetails: details }))}
              errors={fieldErrors}
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
              photo={playerPhotos.playerThree}
              onPhotoChange={(file) => setPlayerPhotos((current) => ({ ...current, playerThree: file }))}
              hasCommercialAgreement={form.playerThreeHasCommercialAgreement ?? false}
              commercialAgreementDetails={form.playerThreeCommercialAgreementDetails ?? ''}
              onCommercialAgreementChange={(hasAgreement, details) => setForm((current) => ({ ...current, playerThreeHasCommercialAgreement: hasAgreement, playerThreeCommercialAgreementDetails: details }))}
              errors={fieldErrors}
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
                    />
                    <FieldError message={fieldErrors.paymentProof} />
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
  photo: File | null;
  hasCommercialAgreement: boolean;
  commercialAgreementDetails: string;
  required?: boolean;
  fieldPrefix: PlayerFieldPrefix;
  onPhotoChange: (file: File | null) => void;
  onCommercialAgreementChange: (hasAgreement: boolean, details: string) => void;
  errors: FieldErrors;
  onChange: (field: keyof PublicRegistrationPayload, value: string) => void;
}) {
  const isOptional = !props.required;
  const hasName = props.name.trim().length > 0;
  const shouldRequire = props.required || hasName;
  const fieldError = (suffix: string) => props.errors[`${props.fieldPrefix}${suffix}`];

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
          />
          <FieldError message={fieldError('Name')} />
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
          />
          <FieldError message={fieldError('Dni')} />
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
          />
          <FieldError message={fieldError('BirthDate')} />
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
          />
          <FieldError message={fieldError('Phone')} />
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
          <FieldError message={fieldError('Instagram')} />
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
          >
            {shirtSizeLabels.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          <FieldError message={fieldError('ShirtSize')} />
        </label>
        <label>
          Foto de la jugadora
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => props.onPhotoChange(event.target.files?.[0] ?? null)} />
          <small className="field-hint">Sube una imagen para que te presentemos en redes como pelotari</small>
          <FieldError message={fieldError('Photo')} />
        </label>
      </div>
      {shouldRequire ? <label className="checkbox-row">
        <input type="checkbox" checked={props.hasCommercialAgreement} onChange={(event) => props.onCommercialAgreementChange(event.target.checked, props.commercialAgreementDetails)} />
        Tenés acuerdo con alguna marca de Paleta
      </label> : null}
      {shouldRequire && props.hasCommercialAgreement ? <label>Marca de Paleta<select value={props.commercialAgreementDetails} onChange={(event) => props.onCommercialAgreementChange(true, event.target.value)} required><option value="">Seleccionar marca</option><option value="Guastavino">Guastavino</option><option value="Dabber">Dabber</option><option value="Otra">Otra</option></select></label> : null}
      {shouldRequire && props.hasCommercialAgreement ? <FieldError message={fieldError('CommercialAgreementDetails')} /> : null}
    </div>
  );
}

function FieldError({ message }: { message?: string }) { return message ? <small className="field-error">{message}</small> : null; }

function validateRegistration(form: PublicRegistrationPayload, paymentProof: File | null, feeWaived: boolean): FieldErrors {
  const errors: FieldErrors = {};
  const required = (field: keyof PublicRegistrationPayload, label: string, min = 1) => { if (!String(form[field] ?? '').trim() || String(form[field] ?? '').trim().length < min) errors[field] = min > 1 ? `${label} debe tener al menos ${min} caracteres.` : `${label} es obligatorio.`; };
  required('representingText', 'La ciudad o provincia', 4);
  if (!form.tournamentAvailabilityConfirmed) errors.tournamentAvailabilityConfirmed = 'Debes confirmar disponibilidad.';
  if (form.heardAboutSource === 'OTHER') required('heardAboutOtherText', 'El otro medio', 2);
  if (form.contactEmail && !/^\S+@\S+\.\S+$/.test(form.contactEmail)) errors.contactEmail = 'Ingresá un email válido.';
  if (!feeWaived && !paymentProof) errors.paymentProof = 'Debes adjuntar el comprobante de pago.';
  (['playerOne', 'playerTwo', 'playerThree'] as PlayerFieldPrefix[]).forEach((prefix, index) => {
    const active = index < 2 || Boolean(String(form[`${prefix}Name` as keyof PublicRegistrationPayload] ?? '').trim());
    if (!active) return;
    const names: [string, string, number][] = [['Name', 'El nombre', 4], ['Dni', 'El DNI', 6], ['BirthDate', 'La fecha de nacimiento', 1], ['Phone', 'El celular', 6]];
    names.forEach(([suffix, label, min]) => { const field = `${prefix}${suffix}` as keyof PublicRegistrationPayload; required(field, label, min); });
    const agreement = form[`${prefix}HasCommercialAgreement` as keyof PublicRegistrationPayload];
    if (agreement && !form[`${prefix}CommercialAgreementDetails` as keyof PublicRegistrationPayload]) errors[`${prefix}CommercialAgreementDetails`] = 'Seleccioná una marca.';
  });
  return errors;
}

function validationErrorsFromMessage(message: string): FieldErrors {
  const fields = ['playerOneName', 'playerOneDni', 'playerOneBirthDate', 'playerOnePhone', 'playerOneCommercialAgreementDetails', 'playerTwoName', 'playerTwoDni', 'playerTwoBirthDate', 'playerTwoPhone', 'playerTwoCommercialAgreementDetails', 'playerThreeName', 'playerThreeDni', 'playerThreeBirthDate', 'playerThreePhone', 'playerThreeCommercialAgreementDetails', 'representingText', 'contactEmail'];
  return fields.reduce<FieldErrors>((errors, field) => {
    if (message.includes(field)) errors[field] = 'Revisá este campo.';
    return errors;
  }, {});
}
