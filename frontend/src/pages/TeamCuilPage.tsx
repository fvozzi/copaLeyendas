import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getPublicTeamCuilRoster, updatePublicTeamCuilRoster } from '../lib/api';
import type { PublicTeamCuilRoster } from '../types';

export function TeamCuilPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token')?.trim() ?? '';
  const [roster, setRoster] = useState<PublicTeamCuilRoster | null>(null);
  const [values, setValues] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('El enlace no contiene un token valido.');
      setLoading(false);
      return;
    }
    getPublicTeamCuilRoster(token)
      .then((result) => {
        setRoster(result);
        setValues(Object.fromEntries(result.players.map((player) => [player.id, ''])));
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, [token]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!roster) return;
    setSaving(true);
    setError(null);
    try {
      await updatePublicTeamCuilRoster(token, roster.players.map((player) => ({
        playerId: player.id, cuil: values[player.id]?.trim() ?? '',
      })));
      setSaved(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudieron guardar los CUIL.');
    } finally {
      setSaving(false);
    }
  };

  return <section className="registration-band registration-band-stacked cuil-page">
    <div className="registration-copy">
      <p className="eyebrow">Datos para el seguro</p>
      <h1>CUIL de las jugadoras</h1>
      <p>Completá el CUIL real de cada integrante. El sistema comprobará que corresponda al DNI informado y que su dígito verificador sea válido.</p>
    </div>
    {loading ? <div className="inline-state">Abriendo el equipo...</div> : null}
    {error ? <div className="inline-state" role="alert">{error}</div> : null}
    {saved ? <div className="registration-success" role="status"><p className="eyebrow">Datos recibidos</p><h2>Los CUIL quedaron guardados</h2><p>Ya podés cerrar esta página. Si necesitás corregir alguno, podés volver a abrir el mismo enlace.</p></div> : null}
    {roster && !saved ? <>
      <section className="grant-card">
        <div><p className="eyebrow">Equipo</p><h2>{roster.teamName}</h2><p>{roster.categoryName}</p></div>
      </section>
      <form className="registration-form registration-form-wide cuil-form" onSubmit={submit}>
        {roster.players.map((player) => <label className="cuil-player" key={player.id}>
          <span><strong>{player.fullName}</strong><small>DNI {player.maskedDni}</small></span>
          {player.completed ? <small className="cuil-loaded">CUIL ya cargado · termina en {player.cuilLastDigits}</small> : null}
          <input
            inputMode="numeric"
            autoComplete="off"
            value={values[player.id] ?? ''}
            onChange={(event) => setValues((current) => ({ ...current, [player.id]: event.target.value }))}
            placeholder={player.completed ? 'Dejar vacio para conservar' : 'Ej. 20-12345678-6'}
            required={!player.completed}
            aria-label={`CUIL de ${player.fullName}`}
          />
        </label>)}
        <div className="form-actions span-2"><button type="submit" className="primary-button" disabled={saving}>{saving ? 'Guardando...' : 'Guardar CUIL'}</button></div>
      </form>
    </> : null}
  </section>;
}
