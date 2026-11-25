import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CourtMap } from '../components/CourtMap';
import { createPublicCourt, searchCommunityCourtLocation } from '../lib/api';
import { communityCourtTypeLabels, courtColorLabels, frontisFinishLabels, frontonBackLabels, frontonWallLabels, shareMaterialLabels, southAmericanCountries } from '../lib/court-directory';
import type { CommunityCourt, CommunityCourtColor, CommunityCourtType, CommunityFrontisFinish, FrontonBackType, FrontonWallOrientation, TrinquetShareMaterial } from '../types';

type SimplePlayerGender = 'MALE' | 'FEMALE';
const playerAgeBands = [
  { label: 'Entre 0 y 20', minAge: 0, maxAge: 20 },
  { label: 'Entre 20 y 60', minAge: 20, maxAge: 60 },
  { label: 'Entre 60 y 100', minAge: 60, maxAge: 100 },
] as const;
const emptyPlayerCounts = (): Record<SimplePlayerGender, string[]> => ({ MALE: ['', '', ''], FEMALE: ['', '', ''] });
const emptyCourtForm = () => ({
  name: '', country: 'Argentina', province: '', locality: '', address: '', lengthMeters: '', widthMeters: '',
  frontisFinish: 'HARD' as CommunityFrontisFinish, courtColor: 'WHITE' as CommunityCourtColor, history: '', inaugurationDate: '',
  contactName: '', contactPhone: '', contactEmail: '', contactUrl: '', hasSchool: false,
  courtType: 'TRINQUET' as CommunityCourtType, trinquetShareMaterial: 'WOOD' as TrinquetShareMaterial, trinquetShareMaterialOther: '',
  frontonWallOrientation: 'LEFT_LONG' as FrontonWallOrientation, frontonHasCacerola: false,
  frontonBackType: 'REBOUND' as FrontonBackType, frontonReboundMaterial: '',
});

export function CourtSubmissionPage() {
  const [form, setForm] = useState(emptyCourtForm);
  const [position, setPosition] = useState<{ latitude: number; longitude: number } | null>(null);
  const [playerCounts, setPlayerCounts] = useState(emptyPlayerCounts);
  const [photos, setPhotos] = useState<File[]>([]);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CommunityCourt | null>(null);
  const photoPreviews = useMemo(() => photos.map((file) => ({ file, url: URL.createObjectURL(file) })), [photos]);

  useEffect(() => () => photoPreviews.forEach(({ url }) => URL.revokeObjectURL(url)), [photoPreviews]);

  const change = (field: keyof typeof form, value: string) => setForm((current) => ({ ...current, [field]: value }));
  const changePlayerCount = (gender: SimplePlayerGender, bandIndex: number, value: string) => setPlayerCounts((current) => ({
    ...current, [gender]: current[gender].map((count, index) => index === bandIndex ? value : count),
  }));
  const choosePhotos = (files: FileList | null) => {
    const selected = Array.from(files ?? []);
    if (selected.length > 6) { setError('Podés agregar hasta 6 fotos de la cancha.'); return; }
    if (selected.some((file) => file.size > 8 * 1024 * 1024)) { setError('Cada foto puede pesar hasta 8 MB.'); return; }
    if (selected.some((file) => !['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'].includes(file.type))) { setError('Las fotos deben ser JPG, PNG, WebP, HEIC o HEIF.'); return; }
    setError(null); setPhotos(selected);
  };

  const searchLocation = async () => {
    const query = [form.address, form.locality, form.province, form.country].filter(Boolean).join(', ');
    if (!form.locality.trim() || !form.province.trim()) { setError('Completá localidad y provincia/departamento para buscar la ubicación.'); return; }
    setLocating(true); setError(null);
    try {
      const countryCode = southAmericanCountries.find((country) => country.name === form.country)?.code;
      const result = await searchCommunityCourtLocation({ query, countryCode });
      setPosition({ latitude: result.latitude, longitude: result.longitude });
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo ubicar la cancha.'); }
    finally { setLocating(false); }
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) { setError('Este dispositivo no permite obtener la ubicación.'); return; }
    setLocating(true); setError(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => { setPosition({ latitude: roundCoordinate(coords.latitude), longitude: roundCoordinate(coords.longitude) }); setLocating(false); },
      () => { setError('No pudimos obtener tu ubicación. Podés marcarla manualmente en el mapa.'); setLocating(false); },
      { enableHighAccuracy: true, timeout: 12_000 },
    );
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError(null);
    if (!position) { setError('Ubicá la cancha en el mapa antes de enviarla.'); return; }
    const enteredCounts = playerAgeBands.flatMap((band, bandIndex) => (['MALE', 'FEMALE'] as const).map((gender) => ({
      gender, minAge: band.minAge, maxAge: band.maxAge, playerCount: Number(playerCounts[gender][bandIndex]), rawValue: playerCounts[gender][bandIndex],
    })));
    if (enteredCounts.some((group) => group.rawValue !== '' && (!Number.isInteger(group.playerCount) || group.playerCount < 0 || group.playerCount > 100_000))) { setError('Las cantidades deben ser números enteros entre 0 y 100.000.'); return; }
    const parsedGroups = enteredCounts.filter((group) => group.playerCount > 0).map(({ gender, minAge, maxAge, playerCount }) => ({ gender, minAge, maxAge, playerCount }));
    if (parsedGroups.length === 0) { setError('Indicá al menos una cantidad de hombres o mujeres.'); return; }
    setSaving(true);
    try {
      setCreated(await createPublicCourt({
        name: form.name.trim(), country: form.country, province: form.province.trim(), locality: form.locality.trim(), address: form.address.trim() || null,
        courtType: form.courtType,
        frontisFinish: form.frontisFinish,
        courtColor: form.courtColor,
        history: form.history.trim() || null,
        inaugurationDate: form.inaugurationDate || null,
        contactName: form.contactName.trim() || null,
        contactPhone: form.contactPhone.trim() || null,
        contactEmail: form.contactEmail.trim() || null,
        contactUrl: form.contactUrl.trim() || null,
        hasSchool: form.hasSchool,
        trinquetShareMaterial: form.courtType === 'TRINQUET' ? form.trinquetShareMaterial : null,
        trinquetShareMaterialOther: form.courtType === 'TRINQUET' && form.trinquetShareMaterial === 'OTHER' ? form.trinquetShareMaterialOther.trim() || null : null,
        frontonWallOrientation: form.courtType === 'FRONTON' ? form.frontonWallOrientation : null,
        frontonHasCacerola: form.courtType === 'FRONTON' ? form.frontonHasCacerola : null,
        frontonBackType: form.courtType === 'FRONTON' ? form.frontonBackType : null,
        frontonReboundMaterial: form.courtType === 'FRONTON' && form.frontonBackType === 'REBOUND' ? form.frontonReboundMaterial.trim() || null : null,
        latitude: position.latitude, longitude: position.longitude,
        lengthMeters: form.lengthMeters === '' ? null : Number(form.lengthMeters), widthMeters: form.widthMeters === '' ? null : Number(form.widthMeters),
        playerGroups: parsedGroups,
      }, photos));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo guardar la cancha.'); }
    finally { setSaving(false); }
  };

  if (created) return <section className="content-band"><div className="registration-success court-submission-success"><p className="eyebrow">Cancha publicada</p><h1>{created.name} ya forma parte del mapa</h1><p>Gracias por ayudar a construir el directorio de la comunidad pelotari.</p><div className="form-actions"><Link to="/canchas" className="primary-button">Ver todas las canchas</Link><button type="button" className="secondary-button" onClick={() => { setCreated(null); setForm(emptyCourtForm()); setPosition(null); setPlayerCounts(emptyPlayerCounts()); setPhotos([]); }}>Cargar otra cancha</button></div></div></section>;

  return <section className="content-band court-submission-page">
    <header className="court-submission-heading"><div><p className="eyebrow">Directorio comunitario</p><h1>Sumá tu cancha al mapa</h1><p>Completá los datos y marcá la ubicación exacta. Las medidas son opcionales.</p></div><Link to="/canchas" className="inline-link">← Volver al mapa</Link></header>
    <form className="court-submission-form" onSubmit={submit}>
      {error && <div className="inline-state court-form-wide" role="alert">{error}</div>}
      <section className="court-form-card"><div className="section-heading"><div><p className="eyebrow">1 · Identificación</p><h2>Datos de la cancha</h2></div></div>
        <div className="court-form-grid"><label className="court-form-wide">Nombre de la cancha<input value={form.name} onChange={(event) => change('name', event.target.value)} minLength={2} maxLength={140} required /></label>
          <label>Tipo de cancha<select value={form.courtType} onChange={(event) => change('courtType', event.target.value)}>{Object.entries(communityCourtTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>País<select value={form.country} onChange={(event) => change('country', event.target.value)} required>{southAmericanCountries.map((country) => <option key={country.code}>{country.name}</option>)}</select></label>
          <label>Provincia / departamento / estado<input value={form.province} onChange={(event) => change('province', event.target.value)} required /></label>
          <label>Localidad<input value={form.locality} onChange={(event) => change('locality', event.target.value)} required /></label>
          <label>Dirección o referencia <span>(opcional)</span><input value={form.address} onChange={(event) => change('address', event.target.value)} /></label>
          <label>Frontón<select value={form.frontisFinish} onChange={(event) => change('frontisFinish', event.target.value)}>{Object.entries(frontisFinishLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Color<select value={form.courtColor} onChange={(event) => change('courtColor', event.target.value)}>{Object.entries(courtColorLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Fecha de inauguración <span>(opcional)</span><input type="date" value={form.inaugurationDate} onChange={(event) => change('inaugurationDate', event.target.value)} /></label>
          <label className="checkbox-row court-feature-checkbox"><input type="checkbox" checked={form.hasSchool} onChange={(event) => setForm((current) => ({ ...current, hasSchool: event.target.checked }))} /><span>Cuenta con escuelita</span></label>
          <label>Largo en metros <span>(opcional)</span><input type="number" min="1" max="200" step="0.01" value={form.lengthMeters} onChange={(event) => change('lengthMeters', event.target.value)} /></label>
          <label>Ancho en metros <span>(opcional)</span><input type="number" min="1" max="200" step="0.01" value={form.widthMeters} onChange={(event) => change('widthMeters', event.target.value)} /></label>
          <label className="court-form-wide">Historia de la cancha <span>(opcional)</span><textarea rows={5} maxLength={3000} value={form.history} onChange={(event) => change('history', event.target.value)} placeholder="Contanos cuándo nació, quiénes la impulsaron o algún hecho importante de su historia." /></label>
          <fieldset className="court-contact-fields court-form-wide"><legend>Datos de contacto <span>(opcionales y públicos)</span></legend>
            <label>Nombre o institución<input maxLength={120} value={form.contactName} onChange={(event) => change('contactName', event.target.value)} /></label>
            <label>Teléfono / WhatsApp<input type="tel" maxLength={40} value={form.contactPhone} onChange={(event) => change('contactPhone', event.target.value)} placeholder="Ej. +54 9 11 1234-5678" /></label>
            <label>Correo electrónico<input type="email" maxLength={160} value={form.contactEmail} onChange={(event) => change('contactEmail', event.target.value)} /></label>
            <label>Web o red social<input type="url" maxLength={300} value={form.contactUrl} onChange={(event) => change('contactUrl', event.target.value)} placeholder="https://..." /></label>
          </fieldset>
          {form.courtType === 'TRINQUET' ? <>
            <label>Material del share<select value={form.trinquetShareMaterial} onChange={(event) => change('trinquetShareMaterial', event.target.value)}>{Object.entries(shareMaterialLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            {form.trinquetShareMaterial === 'OTHER' && <label>Otro material del share<input value={form.trinquetShareMaterialOther} onChange={(event) => change('trinquetShareMaterialOther', event.target.value)} minLength={2} maxLength={100} required /></label>}
          </> : <>
            <label className="court-form-wide">Orientación de las paredes<select value={form.frontonWallOrientation} onChange={(event) => change('frontonWallOrientation', event.target.value)}>{Object.entries(frontonWallLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="checkbox-row court-feature-checkbox"><input type="checkbox" checked={form.frontonHasCacerola} onChange={(event) => setForm((current) => ({ ...current, frontonHasCacerola: event.target.checked }))} /><span>Tiene cacerola</span></label>
            <label>Fondo<select value={form.frontonBackType} onChange={(event) => change('frontonBackType', event.target.value)}>{Object.entries(frontonBackLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            {form.frontonBackType === 'REBOUND' && <label>Material del rebote<input value={form.frontonReboundMaterial} onChange={(event) => change('frontonReboundMaterial', event.target.value)} minLength={2} maxLength={100} placeholder="Ej. material, madera, chapa" required /></label>}
          </>}
        </div>
      </section>

      <section className="court-form-card"><div className="section-heading"><div><p className="eyebrow">2 · Fotos</p><h2>Mostrá la cancha</h2><p>Podés sumar hasta 6 fotos. Se aceptan JPG, PNG, WebP, HEIC o HEIF de hasta 8 MB cada una.</p></div></div>
        <label className="court-photo-picker">Agregar fotos <span>(opcional)</span><input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple onChange={(event) => choosePhotos(event.target.files)} /></label>
        {photoPreviews.length > 0 && <div className="court-photo-previews">{photoPreviews.map(({ file, url }, index) => <figure key={`${file.name}-${file.lastModified}`}><img src={url} alt={`Vista previa ${index + 1} de la cancha`} /><figcaption><span>{file.name}</span><button type="button" className="danger-link" onClick={() => setPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index))}>Quitar</button></figcaption></figure>)}</div>}
      </section>

      <section className="court-form-card"><div className="section-heading"><div><p className="eyebrow">3 · Ubicación</p><h2>Marcá el punto exacto</h2><p>Buscá la localidad y después tocá el lugar preciso dentro del mapa.</p></div></div>
        <div className="court-location-actions"><button type="button" className="secondary-button" onClick={() => void searchLocation()} disabled={locating}>{locating ? 'Buscando...' : 'Buscar localidad'}</button><button type="button" className="secondary-button" onClick={useMyLocation} disabled={locating}>Usar mi ubicación</button>{position && <span>{position.latitude.toFixed(6)}, {position.longitude.toFixed(6)}</span>}<small>Búsqueda y mapa provistos por OpenStreetMap.</small></div>
        <CourtMap position={position} onPositionChange={setPosition} className="court-picker-map" />
      </section>

      <section className="court-form-card"><div className="section-heading"><div><p className="eyebrow">4 · Comunidad</p><h2>Cantidad de jugadores/as</h2><p>Completá solamente los casilleros que correspondan. Podés dejar el resto vacío o en cero.</p></div></div>
        <div className="court-player-matrix"><table><thead><tr><th scope="col">Edad</th><th scope="col">Hombres</th><th scope="col">Mujeres</th></tr></thead><tbody>{playerAgeBands.map((band, bandIndex) => <tr key={band.label}><th scope="row">{band.label}</th>{(['MALE', 'FEMALE'] as const).map((gender) => <td key={gender}><input aria-label={`${gender === 'MALE' ? 'Hombres' : 'Mujeres'}, ${band.label.toLocaleLowerCase('es')}`} type="number" inputMode="numeric" min="0" max="100000" step="1" placeholder="0" value={playerCounts[gender][bandIndex]} onChange={(event) => changePlayerCount(gender, bandIndex, event.target.value)} /></td>)}</tr>)}</tbody></table></div>
      </section>
      <div className="court-form-submit"><p>Al enviar, la cancha quedará visible en el directorio público.</p><button className="primary-button" disabled={saving}>{saving ? 'Guardando...' : 'Publicar cancha'}</button></div>
    </form>
  </section>;
}

function roundCoordinate(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}
